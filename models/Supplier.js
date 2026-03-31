const mongoose = require('mongoose');

// ── Supplier (مورد) ───────────────────────────────────────────────────────────
const supplierSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 200 },
  phone:     { type: String, trim: true },
  phone2:    { type: String, trim: true },
  address:   { type: String, trim: true },
  category:  { type: String, trim: true },          // e.g. "سباكة", "كهرباء"
  notes:     { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

supplierSchema.index({ isDeleted: 1 });

// ── Property Owner (مالك عقار) ───────────────────────────────────────────────
const ownerSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true, maxlength: 200 },
  phone:      { type: String, trim: true },
  phone2:     { type: String, trim: true },
  nationalId: { type: String, trim: true },
  address:    { type: String, trim: true },
  notes:      { type: String, trim: true },
  // each owner can own multiple properties
  properties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted:  { type: Boolean, default: false }
}, { timestamps: true });

ownerSchema.index({ isDeleted: 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);
const Owner    = mongoose.model('Owner',    ownerSchema);

module.exports = { Supplier, Owner };
