const ActivityLog = require('../models/ActivityLog');
const logger = require('./logger');

const log = async ({ action, user, targetModel, targetId, details, meta }) => {
  try {
    await ActivityLog.create({
      action,
      performedBy: user._id || user,
      userName: user.name || 'System',
      targetModel,
      targetId,
      details,
      meta
    });
  } catch (err) {
    logger.error('ActivityLog error:', err);
  }
};

module.exports = log;
