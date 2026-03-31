const Apartment = require('../models/Apartment');
const Contract  = require('../models/Contract');
const log       = require('../utils/activityLog');

// GET /api/apartments?property=xxx
exports.getApartments = async (req, res) => {
  try {
    const filter = { isDeleted: false };
    if (req.query.property) filter.property = req.query.property;

    const apartments = await Apartment.find(filter)
      .populate('property', 'name address')
      .sort({ number: 1 });

    // Attach active contract info
    const enriched = await Promise.all(apartments.map(async (apt) => {
      const contract = await Contract.findOne({ apartment: apt._id, status: 'active' }).select('tenantName tenantPhone annualRent startDate endDate paymentSchedule');
      return { ...apt.toObject(), activeContract: contract || null };
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/apartments/:id
exports.getApartment = async (req, res) => {
  try {
    const apt = await Apartment.findOne({ _id: req.params.id, isDeleted: false }).populate('property', 'name address');
    if (!apt) return res.status(404).json({ success: false, message: 'الشقة غير موجودة' });
    const contract = await Contract.findOne({ apartment: apt._id, status: 'active' });
    res.json({ success: true, data: { ...apt.toObject(), activeContract: contract } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/apartments/:id
exports.updateApartment = async (req, res) => {
  try {
    const apt = await Apartment.findOne({ _id: req.params.id, isDeleted: false });
    if (!apt) return res.status(404).json({ success: false, message: 'الشقة غير موجودة' });
    if (apt.status === 'rented') {
      return res.status(400).json({ success: false, message: 'لا يمكن تعديل شقة مؤجرة - أنهِ العقد أولاً' });
    }

    const { rooms, halls, hasKitchen, bathrooms, floor, notes } = req.body;
    Object.assign(apt, { rooms, halls, hasKitchen, bathrooms, floor, notes });
    await apt.save();

    await log({ action: 'UPDATE_APARTMENT', user: req.user, targetModel: 'Apartment', targetId: apt._id, details: `تعديل شقة رقم ${apt.number}` });
    res.json({ success: true, data: apt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/apartments/:id
exports.deleteApartment = async (req, res) => {
  try {
    const apt = await Apartment.findOne({ _id: req.params.id, isDeleted: false });
    if (!apt) return res.status(404).json({ success: false, message: 'الشقة غير موجودة' });
    if (apt.status === 'rented') {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف شقة مؤجرة' });
    }

    apt.isDeleted = true;
    await apt.save();
    await Contract.updateMany({ apartment: apt._id }, { status: 'terminated' });

    await log({ action: 'DELETE_APARTMENT', user: req.user, targetModel: 'Apartment', targetId: apt._id, details: `حذف شقة رقم ${apt.number}` });
    res.json({ success: true, message: 'تم حذف الشقة' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
