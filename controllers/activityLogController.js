const ActivityLog = require('../models/ActivityLog');

exports.getLogs = async (req, res) => {
  try {
    const { action, user, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (user)   filter.performedBy = user;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo)   filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23,59,59));
    }

    const total = await ActivityLog.countDocuments(filter);
    const logs  = await ActivityLog.find(filter)
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, data: logs, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLogActions = (req, res) => {
  const actions = [
    'CREATE_PROPERTY', 'UPDATE_PROPERTY', 'DELETE_PROPERTY',
    'CREATE_APARTMENT', 'UPDATE_APARTMENT', 'DELETE_APARTMENT',
    'CREATE_CONTRACT', 'UPDATE_CONTRACT', 'TERMINATE_CONTRACT', 'RENEW_CONTRACT',
    'RECORD_PAYMENT', 'CANCEL_PAYMENT',
    'CREATE_EXPENSE', 'DELETE_EXPENSE',
    'CREATE_METER', 'UPDATE_METER', 'DELETE_METER',
    'CREATE_BILL', 'PAY_BILL', 'DELETE_BILL',
    'CREATE_USER', 'UPDATE_USER', 'APPROVE_USER', 'REJECT_USER', 'DELETE_USER',
    'LOGIN', 'LOGOUT'
  ];
  res.json({ success: true, data: actions });
};
