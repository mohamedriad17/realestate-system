const router = require('express').Router();
const { getPayments, collectPayment, cancelPayment, getCurrentMonthPayments } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
router.use(protect);
router.get('/', getPayments);
router.get('/current-month', getCurrentMonthPayments);
router.patch('/:contractId/:paymentId/collect', authorize('admin','employee'), collectPayment);
router.patch('/:contractId/:paymentId/cancel', authorize('admin'), cancelPayment);
module.exports = router;
