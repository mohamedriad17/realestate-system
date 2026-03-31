const mongoose = require('mongoose');

const paymentScheduleSchema = new mongoose.Schema({
  dueDate:     { type: Date, required: true },
  amount:      { type: Number, required: true },
  isPaid:      { type: Boolean, default: false },
  paidDate:    { type: Date },
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiptNote: { type: String }
}, { _id: true });

const contractSchema = new mongoose.Schema({
  property:       { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  apartment:      { type: mongoose.Schema.Types.ObjectId, ref: 'Apartment', required: true },
  tenantName:     { type: String, required: true, trim: true },
  tenantPhone:    { type: String, required: true, trim: true },
  annualRent:     { type: Number, required: true, min: 0 },
  paymentsCount:  { type: Number, enum: [1, 2, 3, 4, 6, 12], required: true },
  paymentSchedule:[ paymentScheduleSchema ],
  commission:             { type: Number, default: 0 },
  firstPaymentCommission: { type: Number, default: 0 },
  deposit:                { type: Number, default: 0 },
  depositReturned:        { type: Boolean, default: false },
  paymentMethod:          { type: String, enum: ['cash','bank_transfer','check','other'], default: 'cash' },
  startDate:      { type: Date, required: true },
  endDate:        { type: Date, required: true },
  durationMonths: { type: Number, default: 12 },
  status:         { type: String, enum: ['active', 'expired', 'terminated'], default: 'active' },
  notes:          { type: String },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rentHistory:    [{
    changedAt:  { type: Date, default: Date.now },
    oldRent:    { type: Number },
    newRent:    { type: Number },
    changedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

contractSchema.index({ property: 1, apartment: 1, status: 1 });
contractSchema.index({ endDate: 1, status: 1 });
contractSchema.index({ 'paymentSchedule.dueDate': 1, 'paymentSchedule.isPaid': 1 });

module.exports = mongoose.model('Contract', contractSchema);
