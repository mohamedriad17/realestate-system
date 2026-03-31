const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

const expenseSchema = new mongoose.Schema({
  voucherNumber: { type: String, unique: true },
  property:      { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  apartment:     { type: mongoose.Schema.Types.ObjectId, ref: 'Apartment' },
  supplier:      { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },   // NEW: مورد
  type:          {
    type: String,
    enum: ['setup', 'maintenance', 'commission', 'utility', 'installment', 'other'],
    required: true
  },
  amount:        { type: Number, required: true, min: 0 },
  description:   { type: String, required: true, trim: true },
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'check', 'other'], default: 'cash' },
  date:          { type: Date, default: Date.now },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

expenseSchema.pre('save', async function (next) {
  if (this.voucherNumber) return next();
  const counter = await Counter.findByIdAndUpdate(
    'expense_voucher', { $inc: { seq: 1 } }, { new: true, upsert: true }
  );
  this.voucherNumber = `EXP-${String(counter.seq).padStart(5, '0')}`;
  next();
});

expenseSchema.index({ property: 1, type: 1, date: -1 });
expenseSchema.index({ supplier: 1, date: -1 });
expenseSchema.index({ date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
