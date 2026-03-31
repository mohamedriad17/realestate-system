const router = require('express').Router();
const { getNotifications } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getNotifications);

module.exports = router;
