const router = require('express').Router();
const { getPropertyReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
router.use(protect);
router.get('/property/:id', getPropertyReport);
module.exports = router;
