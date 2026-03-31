const User = require('../models/User');
const log = require('../utils/activityLog');

// GET /api/users  (admin only)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/status  (admin: approve/reject)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'حالة غير صالحة' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    await log({
      action: status === 'active' ? 'APPROVE_USER' : 'REJECT_USER',
      user: req.user,
      targetModel: 'User',
      targetId: user._id,
      details: `${status === 'active' ? 'قبول' : 'رفض'} حساب المستخدم: ${user.name}`
    });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/role  (admin)
exports.updateRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'employee', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'صلاحية غير صالحة' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    await log({
      action: 'UPDATE_USER',
      user: req.user,
      targetModel: 'User',
      targetId: user._id,
      details: `تغيير صلاحية ${user.name} إلى ${role}`
    });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id (admin)
exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف حسابك الخاص' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    await log({
      action: 'DELETE_USER',
      user: req.user,
      targetModel: 'User',
      targetId: user._id,
      details: `حذف المستخدم: ${user.name}`
    });
    res.json({ success: true, message: 'تم حذف المستخدم' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
