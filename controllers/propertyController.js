const Property   = require('../models/Property');
const Apartment  = require('../models/Apartment');
const Contract   = require('../models/Contract');
const Expense    = require('../models/Expense');
const Meter      = require('../models/Meter');
const Bill       = require('../models/Bill');
const log        = require('../utils/activityLog');

// GET /api/properties
exports.getProperties = async (req, res) => {
  try {
    const properties = await Property.find({ isDeleted: false })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    // Enrich with stats
    const enriched = await Promise.all(properties.map(async (p) => {
      const apts = await Apartment.find({ property: p._id, isDeleted: false });
      const rented  = apts.filter(a => a.status === 'rented').length;
      const vacant  = apts.filter(a => a.status === 'vacant').length;

      // total expenses
      const expenses = await Expense.find({ property: p._id });
      const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) ;

      // total revenue (paid rent payments)
      const contracts = await Contract.find({ property: p._id });
      let totalRevenue = 0;
      contracts.forEach(c => {
        c.paymentSchedule.forEach(ps => {
          if (ps.isPaid) totalRevenue += ps.amount;
        });
      });

      return {
        ...p.toObject(),
        stats: {
          totalApartments: apts.length,
          rented,
          vacant,
          totalExpenses,
          totalRevenue,
          netProfit: totalRevenue - totalExpenses
        }
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/properties/:id
exports.getProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, isDeleted: false })
      .populate('createdBy', 'name');
    if (!property) return res.status(404).json({ success: false, message: 'العقار غير موجود' });
    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/properties
exports.createProperty = async (req, res) => {
  try {
    const { name, address, setupCost, totalApartments, notes, apartments } = req.body;
    const property = await Property.create({ name, address, setupCost: setupCost || 0, totalApartments, notes, createdBy: req.user._id });

    // Create setup cost expense
    if (setupCost && setupCost > 0) {
      await Expense.create({ property: property._id, type: 'setup', amount: setupCost, description: 'مبلغ السعي للعقار', createdBy: req.user._id });
    }

    // Create apartments
    if (apartments && apartments.length > 0) {
      const aptDocs = apartments.map((a, i) => ({
        property: property._id,
        number: i + 1,
        rooms: a.rooms || 1,
        halls: a.halls || 1,
        hasKitchen: a.hasKitchen !== false,
        bathrooms: a.bathrooms || 1,
        floor: a.floor || 0,
        notes: a.notes || '',
        createdBy: req.user._id
      }));
      await Apartment.insertMany(aptDocs);
    } else {
      // Auto-create empty apartments
      const aptDocs = Array.from({ length: totalApartments }, (_, i) => ({
        property: property._id,
        number: i + 1,
        rooms: 2, halls: 1, hasKitchen: true, bathrooms: 1,
        createdBy: req.user._id
      }));
      await Apartment.insertMany(aptDocs);
    }

    await log({ action: 'CREATE_PROPERTY', user: req.user, targetModel: 'Property', targetId: property._id, details: `إضافة عقار: ${name}` });
    res.status(201).json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/properties/:id
exports.updateProperty = async (req, res) => {
  try {
    const { name, address, notes } = req.body;
    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { name, address, notes },
      { new: true, runValidators: true }
    );
    if (!property) return res.status(404).json({ success: false, message: 'العقار غير موجود' });

    await log({ action: 'UPDATE_PROPERTY', user: req.user, targetModel: 'Property', targetId: property._id, details: `تعديل عقار: ${name}` });
    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/properties/:id  (requires admin password - verified by frontend)
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, isDeleted: false });
    if (!property) return res.status(404).json({ success: false, message: 'العقار غير موجود' });

    // Cascade soft-delete
    await Apartment.updateMany({ property: property._id }, { isDeleted: true });
    await Contract.updateMany({ property: property._id }, { status: 'terminated' });
    await property.set({ isDeleted: true }).save();

    // Log cascade
    await log({ action: 'DELETE_PROPERTY', user: req.user, targetModel: 'Property', targetId: property._id, details: `حذف عقار: ${property.name} مع جميع شققه وعقوده` });
    res.json({ success: true, message: 'تم حذف العقار وجميع بياناته' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
