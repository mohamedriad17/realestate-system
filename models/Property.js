const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true, maxlength: 200 },
  address:       { type: String, required: true, trim: true },
  setupCost:     { type: Number, default: 0, min: 0 },   // مبلغ السعي للعقار
  totalApartments: { type: Number, required: true, min: 1 },
  notes:         { type: String, trim: true, maxlength: 1000 },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted:     { type: Boolean, default: false }
}, { timestamps: true });

propertySchema.index({ isDeleted: 1 });
propertySchema.index({ createdBy: 1 });

module.exports = mongoose.model('Property', propertySchema);
