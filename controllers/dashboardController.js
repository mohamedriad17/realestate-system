const Property  = require('../models/Property');
const Apartment = require('../models/Apartment');
const Contract  = require('../models/Contract');
const Expense   = require('../models/Expense');

exports.getDashboard = async (req, res) => {
  try {
    const now   = new Date();
    const year  = now.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31, 23, 59, 59);

    // Basic counts
    const totalProperties = await Property.countDocuments({ isDeleted: false });
    const totalApartments = await Apartment.countDocuments({ isDeleted: false });
    const rentedApartments = await Apartment.countDocuments({ isDeleted: false, status: 'rented' });
    const vacantApartments = totalApartments - rentedApartments;

    // Annual revenue (paid rent in current year)
    const contracts = await Contract.find({}).populate('property', 'name');
    let annualRevenue = 0;
    let monthlyRevenue = Array(12).fill(0);
    const propertyRevenue = {};

    contracts.forEach(c => {
      const propName = c.property?.name || 'غير معروف';
      if (!propertyRevenue[propName]) propertyRevenue[propName] = 0;

      c.paymentSchedule.forEach(p => {
        if (p.isPaid && p.paidDate) {
          const pd = new Date(p.paidDate);
          if (pd >= yearStart && pd <= yearEnd) {
            annualRevenue += p.amount;
            monthlyRevenue[pd.getMonth()] += p.amount;
            propertyRevenue[propName] += p.amount;
          }
        }
      });
    });

    // Annual expenses
    const expenses = await Expense.find({ date: { $gte: yearStart, $lte: yearEnd } });
    const annualExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // Current month payments due (unpaid)
    const monthStart = new Date(year, now.getMonth(), 1);
    const monthEnd   = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);
    const currentMonthPayments = [];
    contracts.forEach(c => {
      if (c.status !== 'active') return;
      c.paymentSchedule.forEach((p, idx) => {
        const due = new Date(p.dueDate);
        if (due >= monthStart && due <= monthEnd && !p.isPaid) {
          currentMonthPayments.push({
            _id: p._id,
            contractId: c._id,
            paymentIndex: idx,
            property: c.property,
            tenantName: c.tenantName,
            amount: p.amount,
            dueDate: p.dueDate,
            isPaid: false
          });
        }
      });
    });

    // Expiring contracts (within 30 days)
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringContracts = await Contract.find({
      status: 'active',
      endDate: { $gte: now, $lte: in30 }
    }).populate('property', 'name').populate('apartment', 'number').select('tenantName endDate annualRent');

    // Property performance for chart
    const chartData = Object.entries(propertyRevenue).map(([name, revenue]) => ({ name, revenue }));

    res.json({
      success: true,
      data: {
        totalProperties,
        totalApartments,
        rentedApartments,
        vacantApartments,
        annualRevenue,
        annualExpenses,
        netProfit: annualRevenue - annualExpenses,
        monthlyRevenue,
        chartData,
        currentMonthPayments,
        expiringContracts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
