

const Expense = require('../models/Expense');
const log = require('../utils/activityLog');

exports.getExpenses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.property) filter.property = req.query.property;
    if (req.query.apartment) filter.apartment = req.query.apartment;
    if (req.query.type) filter.type = req.query.type;

    const expenses = await Expense.find(filter)
      .populate('property', 'name')
      .populate('apartment', 'number')
      .populate('createdBy', 'name')
      .sort({ date: -1 });

    res.json({ success: true, data: expenses });
  } catch (err) {
    console.error('GET EXPENSES ERROR:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    let { property, apartment, type, amount, description, date } = req.body;

    if (property === '') property = undefined;
    if (apartment === '') apartment = undefined;

    if (!type || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'النوع والمبلغ والوصف مطلوبين'
      });
    }

    const expenseData = {
      type,
      amount,
      description,
      date: date || Date.now(),
      createdBy: req.user._id
    };

    if (property) expenseData.property = property;
    if (apartment) expenseData.apartment = apartment;

    console.log('EXPENSE DATA:', expenseData);

    const expense = await Expense.create(expenseData);

    await log({
      action: 'CREATE_EXPENSE',
      user: req.user,
      targetModel: 'Expense',
      targetId: expense._id,
      details: `إضافة مصروف ${type}: ${amount} ر.س - ${description}`
    });

    const populated = await Expense.findById(expense._id)
      .populate('property', 'name')
      .populate('apartment', 'number')
      .populate('createdBy', 'name');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('CREATE EXPENSE ERROR:', err);
    res.status(500).json({
      success: false,
      message: err.message,
      errors: err.errors || null
    });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'المصروف غير موجود'
      });
    }

    await log({
      action: 'DELETE_EXPENSE',
      user: req.user,
      targetModel: 'Expense',
      targetId: expense._id,
      details: `حذف مصروف: ${expense.amount} ر.س - ${expense.description}`
    });

    res.json({ success: true, message: 'تم حذف المصروف' });
  } catch (err) {
    console.error('DELETE EXPENSE ERROR:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};