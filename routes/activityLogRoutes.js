const router = require('express').Router();
const { getLogs, getLogActions } = require('../controllers/activityLogController');
const { protect, adminOnly } = require('../middleware/auth');
router.use(protect, adminOnly);
router.get('/', getLogs);
router.get('/actions', getLogActions);
module.exports = router;
