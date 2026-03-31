const Contract = require('../models/Contract');
const log      = require('../utils/activityLog');

// GET /api/payments  - all payment schedules (filterable)
exports.getPayments = async (req, res) => {
  try {
    const { property, month, year, isPaid } = req.query;
    const contractFilter = { status: 'active' };
    if (property) contractFilter.property = property;

    const contracts = await Contract.find(contractFilter)
      .populate('property', 'name')
      .populate('apartment', 'number');

    const payments = [];
    contracts.forEach(c => {
      c.paymentSchedule.forEach((p, idx) => {
        const due = new Date(p.dueDate);
        if (month && due.getMonth() + 1 !== parseInt(month)) return;
        if (year && due.getFullYear() !== parseInt(year)) return;
        if (isPaid !== undefined && p.isPaid !== (isPaid === 'true')) return;

        payments.push({
          _id: p._id,
          contractId: c._id,
          paymentIndex: idx,
          property: c.property,
          apartment: c.apartment,
          tenantName: c.tenantName,
          tenantPhone: c.tenantPhone,
          dueDate: p.dueDate,
          amount: p.amount,
          isPaid: p.isPaid,
          paidDate: p.paidDate,
          receiptNote: p.receiptNote
        });
      });
    });

    payments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/payments/:contractId/:paymentId/collect
exports.collectPayment = async (req, res) => {
  try {
    const { contractId, paymentId } = req.params;
    const { receiptNote } = req.body;

    const contract = await Contract.findById(contractId).populate('property', 'name').populate('apartment', 'number');
    if (!contract) return res.status(404).json({ success: false, message: 'العقد غير موجود' });

    const payment = contract.paymentSchedule.id(paymentId);
    if (!payment) return res.status(404).json({ success: false, message: 'الدفعة غير موجودة' });
    if (payment.isPaid) return res.status(400).json({ success: false, message: 'تم تحصيل هذه الدفعة مسبقاً' });

    payment.isPaid   = true;
    payment.paidDate = new Date();
    payment.paidBy   = req.user._id;
    payment.receiptNote = receiptNote || '';
    await contract.save();

    await log({
      action: 'RECORD_PAYMENT',
      user: req.user,
      targetModel: 'Contract',
      targetId: contract._id,
      details: `تحصيل دفعة ${payment.amount} ر.س من ${contract.tenantName} - شقة ${contract.apartment?.number} - ${contract.property?.name}`
    });

    res.json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/payments/:contractId/:paymentId/cancel
exports.cancelPayment = async (req, res) => {
  try {
    const { contractId, paymentId } = req.params;
    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ success: false, message: 'العقد غير موجود' });

    const payment = contract.paymentSchedule.id(paymentId);
    if (!payment) return res.status(404).json({ success: false, message: 'الدفعة غير موجودة' });

    payment.isPaid   = false;
    payment.paidDate = undefined;
    payment.paidBy   = undefined;
    await contract.save();

    await log({
      action: 'CANCEL_PAYMENT',
      user: req.user,
      targetModel: 'Contract',
      targetId: contract._id,
      details: `إلغاء تحصيل دفعة ${payment.amount} ر.س - ${contract.tenantName}`
    });

    res.json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/payments/current-month
exports.getCurrentMonthPayments = async (req, res) => {
  try {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const contracts = await Contract.find({ status: 'active' })
      .populate('property', 'name')
      .populate('apartment', 'number');

    const payments = [];
    contracts.forEach(c => {
      c.paymentSchedule.forEach((p, idx) => {
        const due = new Date(p.dueDate);
        if (due >= start && due <= end) {
          payments.push({
            _id: p._id,
            contractId: c._id,
            paymentIndex: idx,
            property: c.property,
            apartment: c.apartment,
            tenantName: c.tenantName,
            dueDate: p.dueDate,
            amount: p.amount,
            isPaid: p.isPaid,
            paidDate: p.paidDate
          });
        }
      });
    });

    payments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
