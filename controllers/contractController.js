const Contract  = require('../models/Contract');
const Apartment = require('../models/Apartment');
const Expense   = require('../models/Expense');
const log       = require('../utils/activityLog');

// Helper: generate payment schedule
const generateSchedule = (startDate, annualRent, paymentsCount) => {
  const schedule = [];
  const perPayment = annualRent / paymentsCount;
  const intervalMonths = 12 / paymentsCount;
  for (let i = 0; i < paymentsCount; i++) {
    const due = new Date(startDate);
    due.setMonth(due.getMonth() + Math.round(i * intervalMonths));
    schedule.push({ dueDate: due, amount: Math.round(perPayment), isPaid: false });
  }
  return schedule;
};

// POST /api/contracts  - Create new lease
exports.createContract = async (req, res) => {
  try {
    const {
      apartmentId, tenantName, tenantPhone,
      annualRent, paymentsCount, commission,
      deposit, startDate, durationMonths, notes
    } = req.body;

    const apt = await Apartment.findById(apartmentId).populate('property');
    if (!apt || apt.isDeleted) return res.status(404).json({ success: false, message: 'الشقة غير موجودة' });
    if (apt.status === 'rented') return res.status(400).json({ success: false, message: 'الشقة مؤجرة بالفعل' });

    const start = new Date(startDate || Date.now());
    const months = durationMonths || 12;
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    const paymentSchedule = generateSchedule(start, annualRent, paymentsCount);

    const contract = await Contract.create({
      property: apt.property._id,
      apartment: apt._id,
      tenantName, tenantPhone, annualRent,
      paymentsCount, paymentSchedule,
      commission: commission || 0,
      deposit: deposit || 0,
      startDate: start, endDate: end,
      durationMonths: months, notes,
      createdBy: req.user._id
    });

    // Mark apartment as rented
    apt.status = 'rented';
    await apt.save();

    // Record commission as expense
    if (commission && commission > 0) {
      await Expense.create({
        property: apt.property._id,
        apartment: apt._id,
        type: 'commission',
        amount: commission,
        description: `عمولة تأجير شقة ${apt.number} - ${tenantName}`,
        createdBy: req.user._id
      });
    }

    await log({
      action: 'CREATE_CONTRACT',
      user: req.user,
      targetModel: 'Contract',
      targetId: contract._id,
      details: `تأجير شقة ${apt.number} في ${apt.property.name} للمستأجر ${tenantName}`
    });

    res.status(201).json({ success: true, data: contract });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/contracts?property=&apartment=&status=
exports.getContracts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.property)   filter.property = req.query.property;
    if (req.query.apartment)  filter.apartment = req.query.apartment;
    if (req.query.status)     filter.status = req.query.status;

    const contracts = await Contract.find(filter)
      .populate('property', 'name address')
      .populate('apartment', 'number rooms halls hasKitchen bathrooms')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: contracts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/contracts/:id
exports.getContract = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('property', 'name address')
      .populate('apartment', 'number rooms halls hasKitchen bathrooms floor')
      .populate('createdBy', 'name');
    if (!contract) return res.status(404).json({ success: false, message: 'العقد غير موجود' });
    res.json({ success: true, data: contract });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/contracts/:id  - Update contract
exports.updateContract = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'العقد غير موجود' });

    const { annualRent, durationMonths, endDate, notes, tenantName, tenantPhone } = req.body;

    // Track rent change
    if (annualRent && annualRent !== contract.annualRent) {
      contract.rentHistory.push({
        oldRent: contract.annualRent,
        newRent: annualRent,
        changedBy: req.user._id
      });
      contract.annualRent = annualRent;

      // Regenerate unpaid payments
      const unpaid = contract.paymentSchedule.filter(p => !p.isPaid);
      if (unpaid.length > 0) {
        const remaining = unpaid.length;
        const totalRemaining = annualRent * (remaining / contract.paymentsCount);
        const perPayment = Math.round(totalRemaining / remaining);
        unpaid.forEach(p => { p.amount = perPayment; });
      }
    }

    if (tenantName) contract.tenantName = tenantName;
    if (tenantPhone) contract.tenantPhone = tenantPhone;
    if (notes !== undefined) contract.notes = notes;
    if (durationMonths) {
      contract.durationMonths = durationMonths;
      const newEnd = new Date(contract.startDate);
      newEnd.setMonth(newEnd.getMonth() + durationMonths);
      contract.endDate = newEnd;
    }
    if (endDate) contract.endDate = new Date(endDate);

    await contract.save();
    await log({
      action: 'UPDATE_CONTRACT',
      user: req.user,
      targetModel: 'Contract',
      targetId: contract._id,
      details: `تعديل عقد المستأجر ${contract.tenantName}`
    });

    res.json({ success: true, data: contract });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/contracts/:id/terminate
exports.terminateContract = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'العقد غير موجود' });
    if (contract.status !== 'active') return res.status(400).json({ success: false, message: 'العقد غير نشط' });

    contract.status = 'terminated';
    await contract.save();

    await Apartment.findByIdAndUpdate(contract.apartment, { status: 'vacant' });

    await log({
      action: 'TERMINATE_CONTRACT',
      user: req.user,
      targetModel: 'Contract',
      targetId: contract._id,
      details: `إنهاء عقد المستأجر ${contract.tenantName}`
    });

    res.json({ success: true, message: 'تم إنهاء العقد وتحرير الشقة' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/contracts/:id/renew
exports.renewContract = async (req, res) => {
  try {
    const old = await Contract.findById(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: 'العقد غير موجود' });

    const { annualRent, durationMonths, paymentsCount } = req.body;
    const start = new Date(old.endDate);
    const months = durationMonths || old.durationMonths;
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    const newRent = annualRent || old.annualRent;
    const newPayments = paymentsCount || old.paymentsCount;

    const schedule = generateSchedule(start, newRent, newPayments);

    const renewed = await Contract.create({
      property: old.property,
      apartment: old.apartment,
      tenantName: old.tenantName,
      tenantPhone: old.tenantPhone,
      annualRent: newRent,
      paymentsCount: newPayments,
      paymentSchedule: schedule,
      commission: 0,
      deposit: old.deposit,
      startDate: start,
      endDate: end,
      durationMonths: months,
      createdBy: req.user._id
    });

    old.status = 'expired';
    await old.save();

    await log({
      action: 'RENEW_CONTRACT',
      user: req.user,
      targetModel: 'Contract',
      targetId: renewed._id,
      details: `تجديد عقد المستأجر ${old.tenantName}`
    });

    res.status(201).json({ success: true, data: renewed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
