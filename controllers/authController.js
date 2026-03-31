const jwt = require('jsonwebtoken');
const User = require('../models/User');
const log = require('../utils/activityLog');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجّل مسبقاً' });

    // First user becomes admin automatically
    const count = await User.countDocuments();
    const role   = count === 0 ? 'admin' : 'viewer';
    const status = count === 0 ? 'active' : 'pending';

    const user = await User.create({ name, email, password, phone, role, status });
    await log({ action: 'CREATE_USER', user: { _id: user._id, name: user.name }, targetModel: 'User', targetId: user._id, details: `تسجيل مستخدم جديد: ${name}` });

    const token = signToken(user._id);
    res.status(201).json({ success: true, token, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'أدخل البريد وكلمة المرور' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'بيانات غير صحيحة' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ success: false, message: 'الحساب بانتظار موافقة المدير' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ success: false, message: 'تم رفض الحساب. تواصل مع المدير' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await log({ action: 'LOGIN', user, targetModel: 'User', targetId: user._id, details: `تسجيل دخول: ${user.name}` });
    const token = signToken(user._id);
    res.json({ success: true, token, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// POST /api/auth/verify-admin-password
exports.verifyAdminPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const isMatch = password === process.env.ADMIN_DELETE_PASSWORD;
    res.json({ success: isMatch, message: isMatch ? 'تم التحقق' : 'كلمة المرور غير صحيحة' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
