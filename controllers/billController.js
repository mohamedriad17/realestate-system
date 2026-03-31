const Bill   = require('../models/Bill');
const Meter  = require('../models/Meter');
const log    = require('../utils/activityLog');

exports.getBills = async (req, res) => {
  try {
    const filter = {};
    if (req.query.property) filter.property = req.query.property;
    if (req.query.type)     filter.type     = req.query.type;
    const bills = await Bill.find(filter)
      .populate('property', 'name')
      .populate('meter',    'meterNumber type')
      .populate('shares.apartment', 'number')
      .sort({ billDate: -1 });
    res.json({ success: true, data: bills });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBill = async (req, res) => {
  try {
    const { property, meterId, type, totalAmount, billDate, dueDate, billPeriod, notes } = req.body;
    const meter = await Meter.findById(meterId).populate('sharedWith.apartment', 'number');
    if (!meter) return res.status(404).json({ success: false, message: 'العداد غير موجود' });

    let shares = [];
    if (meter.isShared && meter.sharedWith.length > 0) {
      // Validate percentages sum ~100
      shares = meter.sharedWith.map(sw => ({
        apartment: sw.apartment._id || sw.apartment,
        percentage: sw.percentage,
        amount: Math.round(totalAmount * sw.percentage / 100),
        isPaid: false
      }));
    } else if (meter.apartment) {
      shares = [{ apartment: meter.apartment, amount: totalAmount, percentage: 100, isPaid: false }];
    }

    const bill = await Bill.create({ property, meter: meterId, type, totalAmount, billDate, dueDate, billPeriod, shares, notes, createdBy: req.user._id });
    await log({ action: 'CREATE_BILL', user: req.user, targetModel: 'Bill', targetId: bill._id, details: `إضافة فاتورة ${type}: ${totalAmount} ر.س - ${billPeriod}` });
    res.status(201).json({ success: true, data: bill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.payBillShare = async (req, res) => {
  try {
    const { billId, shareId } = req.params;
    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    const share = bill.shares.id(shareId);
    if (!share) return res.status(404).json({ success: false, message: 'الحصة غير موجودة' });
    share.isPaid = true;
    share.paidDate = new Date();
    share.paidBy = req.user._id;
    await bill.save();
    await log({ action: 'PAY_BILL', user: req.user, targetModel: 'Bill', targetId: bill._id, details: `دفع حصة فاتورة: ${share.amount} ر.س` });
    res.json({ success: true, data: share });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    await log({ action: 'DELETE_BILL', user: req.user, targetModel: 'Bill', targetId: bill._id, details: `حذف فاتورة ${bill.type}: ${bill.totalAmount} ر.س` });
    res.json({ success: true, message: 'تم حذف الفاتورة' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
