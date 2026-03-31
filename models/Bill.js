const mongoose = require('mongoose');

const billShareSchema = new mongoose.Schema({
  apartment:   { type: mongoose.Schema.Types.ObjectId, ref: 'Apartment', required: true },
  amount:      { type: Number, required: true },
  percentage:  { type: Number },
  isPaid:      { type: Boolean, default: false },
  paidDate:    { type: Date },
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const billSchema = new mongoose.Schema({
  property:    { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  meter:       { type: mongoose.Schema.Types.ObjectId, ref: 'Meter', required: true },
  type:        { type: String, enum: ['electricity', 'water'], required: true },
  totalAmount: { type: Number, required: true, min: 0 },
  billDate:    { type: Date, required: true },
  dueDate:     { type: Date },
  billPeriod:  { type: String },             // e.g. "يناير 2024"
  shares:      [ billShareSchema ],
  notes:       { type: String },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

billSchema.index({ property: 1, billDate: -1 });
billSchema.index({ 'shares.isPaid': 1 });

module.exports = mongoose.model('Bill', billSchema);
