const mongoose = require('mongoose');

const meterSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },

  apartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Apartment',
    default: null
  },

  scope: {
    type: String,
    enum: ['apartment', 'property'],
    default: 'apartment'
  },

  type: {
    type: String,
    enum: ['electricity', 'water'],
    required: true
  },

  meterNumber: {
    type: String,
    required: true,
    trim: true
  },

  isShared: {
    type: Boolean,
    default: false
  },

  sharedWith: [{
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: true
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    }
  }],

  notes: {
    type: String,
    default: ''
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

meterSchema.index({ property: 1, type: 1 });
meterSchema.index({ property: 1, apartment: 1 });
meterSchema.index({ property: 1, isShared: 1 });
meterSchema.index({ property: 1, scope: 1 });

meterSchema.index(
  { property: 1, apartment: 1, type: 1, meterNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isShared: false,
      scope: 'apartment'
    }
  }
);

meterSchema.index(
  { property: 1, type: 1, meterNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isShared: false,
      scope: 'property'
    }
  }
);

meterSchema.index(
  { property: 1, type: 1, meterNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isShared: true
    }
  }
);

meterSchema.pre('validate', function(next) {
  if (typeof this.meterNumber === 'string') {
    this.meterNumber = this.meterNumber.trim();
  }

  if (typeof this.notes === 'string') {
    this.notes = this.notes.trim();
  }

  if (this.isShared) {
    this.scope = 'property';
    this.apartment = null;

    if (!this.sharedWith || this.sharedWith.length < 2) {
      return next(new Error('العداد المشترك لازم يحتوي على شقتين على الأقل'));
    }

    const cleanedSharedWith = this.sharedWith.map(item => ({
      apartment: item.apartment,
      percentage: Number(item.percentage)
    }));

    const total = cleanedSharedWith.reduce(
      (sum, item) => sum + Number(item.percentage || 0),
      0
    );

    if (total !== 100) {
      return next(new Error('مجموع نسب الشقق لازم يكون 100%'));
    }

    const apartmentIds = cleanedSharedWith.map(item => String(item.apartment));
    const uniqueIds = new Set(apartmentIds);

    if (uniqueIds.size !== apartmentIds.length) {
      return next(new Error('لا يمكن تكرار نفس الشقة في العداد المشترك'));
    }

    this.sharedWith = cleanedSharedWith;
    return next();
  }

  this.sharedWith = [];

  if (this.scope === 'property') {
    this.apartment = null;
    return next();
  }

  if (this.scope === 'apartment') {
    if (!this.apartment) {
      return next(new Error('لازم تختار شقة للعداد الخاص بالشقة'));
    }
    return next();
  }

  next();
});

module.exports = mongoose.model('Meter', meterSchema);