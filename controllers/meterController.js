const Meter = require('../models/Meter');
const log = require('../utils/activityLog');

const buildDuplicateMessage = (body = {}) => {
  if (body.isShared) {
    return 'يوجد بالفعل عداد مشترك بنفس الرقم والنوع داخل هذا العقار';
  }

  if (body.scope === 'property') {
    return 'يوجد بالفعل عداد للعقار بنفس الرقم والنوع داخل هذا العقار';
  }

  return 'يوجد بالفعل عداد لنفس الشقة بنفس الرقم والنوع';
};

const normalizeMeterPayload = (body = {}) => {
  let {
    property,
    apartment,
    scope,
    type,
    meterNumber,
    isShared,
    sharedWith,
    notes,
    isActive
  } = body;

  if (property === '') property = undefined;
  if (apartment === '') apartment = undefined;

  scope = scope || 'apartment';
  isShared = !!isShared;

  if (typeof meterNumber === 'string') {
    meterNumber = meterNumber.trim();
  }

  if (typeof notes === 'string') {
    notes = notes.trim();
  }

  let cleanSharedWith = [];
  if (Array.isArray(sharedWith)) {
    cleanSharedWith = sharedWith
      .filter(item => item && item.apartment && item.apartment !== '')
      .map(item => ({
        apartment: item.apartment,
        percentage: Number(item.percentage || 0)
      }));
  }

  return {
    property,
    apartment,
    scope,
    type,
    meterNumber,
    isShared,
    sharedWith: cleanSharedWith,
    notes,
    isActive
  };
};

exports.getMeters = async (req, res) => {
  try {
    const filter = {};
    if (req.query.property) filter.property = req.query.property;

    const meters = await Meter.find(filter)
      .populate('property', 'name')
      .populate('apartment', 'number')
      .populate('sharedWith.apartment', 'number')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: meters });
  } catch (err) {
    console.error('GET METERS ERROR:', err);
    res.status(500).json({
      success: false,
      message: 'فشل تحميل العدادات'
    });
  }
};

exports.createMeter = async (req, res) => {
  try {
    const payload = normalizeMeterPayload(req.body);

    if (!payload.property || !payload.type || !payload.meterNumber) {
      return res.status(400).json({
        success: false,
        message: 'العقار ونوع العداد ورقم العداد مطلوبين'
      });
    }

    if (payload.isShared) {
      if (payload.sharedWith.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'لازم تحدد على الأقل شقتين للعداد المشترك'
        });
      }

      const total = payload.sharedWith.reduce(
        (sum, item) => sum + Number(item.percentage || 0),
        0
      );

      if (total !== 100) {
        return res.status(400).json({
          success: false,
          message: 'مجموع نسب الشقق لازم يكون 100%'
        });
      }

      const apartmentIds = payload.sharedWith.map(item => String(item.apartment));
      const uniqueIds = new Set(apartmentIds);

      if (uniqueIds.size !== apartmentIds.length) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن تكرار نفس الشقة في العداد المشترك'
        });
      }
    } else if (payload.scope === 'apartment' && !payload.apartment) {
      return res.status(400).json({
        success: false,
        message: 'اختر الشقة الخاصة بهذا العداد'
      });
    }

    const meterData = {
      property: payload.property,
      type: payload.type,
      meterNumber: payload.meterNumber,
      scope: payload.scope,
      isShared: payload.isShared,
      notes: payload.notes,
      createdBy: req.user._id
    };

    if (typeof payload.isActive === 'boolean') {
      meterData.isActive = payload.isActive;
    }

    if (payload.isShared) {
      meterData.apartment = null;
      meterData.scope = 'property';
      meterData.sharedWith = payload.sharedWith;
    } else if (payload.scope === 'property') {
      meterData.apartment = null;
      meterData.sharedWith = [];
    } else {
      meterData.apartment = payload.apartment;
      meterData.sharedWith = [];
    }

    const meter = await Meter.create(meterData);

    await log({
      action: 'CREATE_METER',
      user: req.user,
      targetModel: 'Meter',
      targetId: meter._id,
      details: `إضافة عداد ${meter.type} رقم ${meter.meterNumber}`
    });

    const populated = await Meter.findById(meter._id)
      .populate('property', 'name')
      .populate('apartment', 'number')
      .populate('sharedWith.apartment', 'number');

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('CREATE METER ERROR:', err);

    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: buildDuplicateMessage(req.body)
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || 'فشل إضافة العداد',
      errors: err.errors || null
    });
  }
};

exports.updateMeter = async (req, res) => {
  try {
    const existingMeter = await Meter.findById(req.params.id);
    if (!existingMeter) {
      return res.status(404).json({
        success: false,
        message: 'العداد غير موجود'
      });
    }

    const payload = normalizeMeterPayload(req.body);

    if (!payload.property || !payload.type || !payload.meterNumber) {
      return res.status(400).json({
        success: false,
        message: 'العقار ونوع العداد ورقم العداد مطلوبين'
      });
    }

    if (payload.isShared) {
      if (payload.sharedWith.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'لازم تحدد على الأقل شقتين للعداد المشترك'
        });
      }

      const total = payload.sharedWith.reduce(
        (sum, item) => sum + Number(item.percentage || 0),
        0
      );

      if (total !== 100) {
        return res.status(400).json({
          success: false,
          message: 'مجموع نسب الشقق لازم يكون 100%'
        });
      }

      const apartmentIds = payload.sharedWith.map(item => String(item.apartment));
      const uniqueIds = new Set(apartmentIds);

      if (uniqueIds.size !== apartmentIds.length) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن تكرار نفس الشقة في العداد المشترك'
        });
      }
    } else if (payload.scope === 'apartment' && !payload.apartment) {
      return res.status(400).json({
        success: false,
        message: 'اختر الشقة الخاصة بهذا العداد'
      });
    }

    existingMeter.property = payload.property;
    existingMeter.type = payload.type;
    existingMeter.meterNumber = payload.meterNumber;
    existingMeter.notes = payload.notes;
    existingMeter.isShared = payload.isShared;

    if (typeof payload.isActive === 'boolean') {
      existingMeter.isActive = payload.isActive;
    }

    if (payload.isShared) {
      existingMeter.scope = 'property';
      existingMeter.apartment = null;
      existingMeter.sharedWith = payload.sharedWith;
    } else if (payload.scope === 'property') {
      existingMeter.scope = 'property';
      existingMeter.apartment = null;
      existingMeter.sharedWith = [];
    } else {
      existingMeter.scope = 'apartment';
      existingMeter.apartment = payload.apartment;
      existingMeter.sharedWith = [];
    }

    await existingMeter.save();

    await log({
      action: 'UPDATE_METER',
      user: req.user,
      targetModel: 'Meter',
      targetId: existingMeter._id,
      details: `تعديل عداد ${existingMeter.meterNumber}`
    });

    const populated = await Meter.findById(existingMeter._id)
      .populate('property', 'name')
      .populate('apartment', 'number')
      .populate('sharedWith.apartment', 'number');

    res.json({ success: true, data: populated });
  } catch (err) {
    console.error('UPDATE METER ERROR:', err);

    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: buildDuplicateMessage(req.body)
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || 'فشل تعديل العداد'
    });
  }
};

exports.deleteMeter = async (req, res) => {
  try {
    const meter = await Meter.findByIdAndDelete(req.params.id);

    if (!meter) {
      return res.status(404).json({
        success: false,
        message: 'العداد غير موجود'
      });
    }

    await log({
      action: 'DELETE_METER',
      user: req.user,
      targetModel: 'Meter',
      targetId: meter._id,
      details: `حذف عداد ${meter.meterNumber}`
    });

    res.json({ success: true, message: 'تم حذف العداد' });
  } catch (err) {
    console.error('DELETE METER ERROR:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'فشل حذف العداد'
    });
  }
};