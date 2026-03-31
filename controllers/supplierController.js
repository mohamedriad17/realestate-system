const { Supplier, Owner } = require('../models/Supplier');
const Expense  = require('../models/Expense');
const Property = require('../models/Property');
const log      = require('../utils/activityLog');

// ══ SUPPLIERS ════════════════════════════════════════════════════════════════

exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isDeleted: false })
      .populate('createdBy', 'name').sort({ name: 1 });
    res.json({ success: true, data: suppliers });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/suppliers/suppliers/:id/detail  — supplier + all linked expenses
exports.getSupplierDetail = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier || supplier.isDeleted)
      return res.status(404).json({ success: false, message: 'المورد غير موجود' });

    const expenses = await Expense.find({ supplier: supplier._id })
      .populate('property',  'name address')
      .populate('apartment', 'number')
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    const totalAmount  = expenses.reduce((s, e) => s + e.amount, 0);
    const byType       = expenses.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + e.amount;
      return acc;
    }, {});
    const byProperty   = {};
    expenses.forEach(e => {
      const k = e.property?.name || 'غير محدد';
      byProperty[k] = (byProperty[k] || 0) + e.amount;
    });

    res.json({
      success: true,
      data: {
        supplier,
        expenses,
        summary: { totalAmount, count: expenses.length, byType, byProperty }
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createSupplier = async (req, res) => {
  try {
    const { name, phone, phone2, address, category, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'الاسم مطلوب' });
    const supplier = await Supplier.create({ name, phone, phone2, address, category, notes, createdBy: req.user._id });
    await log({ action: 'CREATE_USER', user: req.user, targetModel: 'Supplier', targetId: supplier._id, details: `إضافة مورد: ${name}` });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'المورد غير موجود' });
    res.json({ success: true, data: supplier });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const s = await Supplier.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!s) return res.status(404).json({ success: false, message: 'المورد غير موجود' });
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ══ OWNERS ════════════════════════════════════════════════════════════════════

exports.getOwners = async (req, res) => {
  try {
    const owners = await Owner.find({ isDeleted: false })
      .populate('properties', 'name address')
      .populate('createdBy', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: owners });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/suppliers/owners/:id/detail  — owner + installment expenses per property
exports.getOwnerDetail = async (req, res) => {
  try {
    const owner = await Owner.findById(req.params.id)
      .populate('properties', 'name address totalApartments');
    if (!owner || owner.isDeleted)
      return res.status(404).json({ success: false, message: 'المالك غير موجود' });

    const propertyIds = owner.properties.map(p => p._id || p);

    // All installment expenses for owner's properties
    const installments = await Expense.find({
      property: { $in: propertyIds },
      type: 'installment'
    }).populate('property', 'name')
      .populate('apartment', 'number')
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    // All expenses (any type) grouped by property for summary
    const allExpenses = await Expense.find({ property: { $in: propertyIds } });
    const expenseSummary = {};
    propertyIds.forEach(pid => {
      const name = owner.properties.find(p => String(p._id) === String(pid))?.name || 'غير معروف';
      const propExps = allExpenses.filter(e => String(e.property) === String(pid));
      const instExps = installments.filter(e => String(e.property) === String(pid));
      expenseSummary[String(pid)] = {
        name,
        totalExpenses:    propExps.reduce((s, e) => s + e.amount, 0),
        totalInstallments:instExps.reduce((s, e) => s + e.amount, 0),
        installmentCount: instExps.length
      };
    });

    const totalInstallments = installments.reduce((s, e) => s + e.amount, 0);

    res.json({
      success: true,
      data: { owner, installments, expenseSummary, totalInstallments }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createOwner = async (req, res) => {
  try {
    const { name, phone, phone2, nationalId, address, notes, properties } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'الاسم مطلوب' });
    const owner = await Owner.create({ name, phone, phone2, nationalId, address, notes, properties: properties || [], createdBy: req.user._id });
    res.status(201).json({ success: true, data: owner });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateOwner = async (req, res) => {
  try {
    const owner = await Owner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('properties', 'name address');
    if (!owner) return res.status(404).json({ success: false, message: 'المالك غير موجود' });
    res.json({ success: true, data: owner });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteOwner = async (req, res) => {
  try {
    const o = await Owner.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!o) return res.status(404).json({ success: false, message: 'المالك غير موجود' });
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
