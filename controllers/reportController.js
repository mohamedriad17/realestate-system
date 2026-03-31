const Property  = require('../models/Property');
const Contract  = require('../models/Contract');
const Expense   = require('../models/Expense');

exports.getPropertyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { year } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const yearStart = new Date(y, 0, 1);
    const yearEnd   = new Date(y, 11, 31, 23, 59, 59);

    const property = await Property.findById(id);
    if (!property) return res.status(404).json({ success: false, message: 'العقار غير موجود' });

    const contracts = await Contract.find({ property: id })
      .populate('apartment', 'number');

    let totalRevenue = 0, paidPayments = [], pendingPayments = [];
    contracts.forEach(c => {
      c.paymentSchedule.forEach(p => {
        const due = new Date(p.dueDate);
        if (due >= yearStart && due <= yearEnd) {
          if (p.isPaid) {
            totalRevenue += p.amount;
            paidPayments.push({ tenant: c.tenantName, apt: c.apartment?.number, amount: p.amount, date: p.paidDate });
          } else {
            pendingPayments.push({ tenant: c.tenantName, apt: c.apartment?.number, amount: p.amount, dueDate: p.dueDate });
          }
        }
      });
    });

    const expenses = await Expense.find({ property: id, date: { $gte: yearStart, $lte: yearEnd } });
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) + (y === new Date().getFullYear() ? 0 : 0);

    const expenseBreakdown = expenses.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + e.amount;
      return acc;
    }, {});

    const deposits = contracts.map(c => ({
      tenant: c.tenantName, apt: c.apartment?.number,
      amount: c.deposit, returned: c.depositReturned
    })).filter(d => d.amount > 0);

    res.json({
      success: true,
      data: {
        property: property.name,
        year: y,
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : 0,
        paidPayments,
        pendingPayments,
        expenseBreakdown,
        deposits
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
