const router = require('express').Router();
const { register, login, getMe, verifyAdminPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/verify-admin-password', protect, verifyAdminPassword);
module.exports = router;
