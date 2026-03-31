const mongoose = require('mongoose');

const apartmentSchema = new mongoose.Schema({
  property:    { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  number:      { type: Number, required: true },           // رقم الشقة
  rooms:       { type: Number, required: true, min: 0 },
  halls:       { type: Number, required: true, min: 0 },
  hasKitchen:  { type: Boolean, default: true },
  bathrooms:   { type: Number, required: true, min: 0 },
  floor:       { type: Number, default: 0 },
  notes:       { type: String, trim: true },
  status:      { type: String, enum: ['vacant', 'rented'], default: 'vacant' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted:   { type: Boolean, default: false }
}, { timestamps: true });

apartmentSchema.index({ property: 1, isDeleted: 1 });
apartmentSchema.index({ property: 1, number: 1 }, { unique: true });
apartmentSchema.index({ status: 1 });

module.exports = mongoose.model('Apartment', apartmentSchema);
