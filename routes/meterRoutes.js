const router = require('express').Router();
const { getMeters, createMeter, updateMeter, deleteMeter } = require('../controllers/meterController');
const { protect, authorize } = require('../middleware/auth');
router.use(protect);
router.get('/', getMeters);
router.post('/', authorize('admin','employee'), createMeter);
router.put('/:id', authorize('admin','employee'), updateMeter);
router.delete('/:id', authorize('admin'), deleteMeter);
module.exports = router;
