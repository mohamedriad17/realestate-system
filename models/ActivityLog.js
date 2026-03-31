const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  action:      {
    type: String,
    enum: [
      'CREATE_PROPERTY', 'UPDATE_PROPERTY', 'DELETE_PROPERTY',
      'CREATE_APARTMENT', 'UPDATE_APARTMENT', 'DELETE_APARTMENT',
      'CREATE_CONTRACT', 'UPDATE_CONTRACT', 'TERMINATE_CONTRACT', 'RENEW_CONTRACT',
      'RECORD_PAYMENT', 'CANCEL_PAYMENT',
      'CREATE_EXPENSE', 'DELETE_EXPENSE',
      'CREATE_METER', 'UPDATE_METER', 'DELETE_METER',
      'CREATE_BILL', 'PAY_BILL', 'DELETE_BILL',
      'CREATE_USER', 'UPDATE_USER', 'APPROVE_USER', 'REJECT_USER', 'DELETE_USER',
      'LOGIN', 'LOGOUT'
    ],
    required: true
  },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:    { type: String, required: true },
  targetModel: { type: String },                  // 'Property', 'Apartment', etc.
  targetId:    { type: mongoose.Schema.Types.ObjectId },
  details:     { type: String },                  // human-readable description
  meta:        { type: mongoose.Schema.Types.Mixed } // extra JSON data
}, { timestamps: true });

activityLogSchema.index({ performedBy: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ targetModel: 1, targetId: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
