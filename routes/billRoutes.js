const router = require('express').Router();
const { getBills, createBill, payBillShare, deleteBill } = require('../controllers/billController');
const { protect, authorize } = require('../middleware/auth');
router.use(protect);
router.get('/', getBills);
router.post('/', authorize('admin','employee'), createBill);
router.patch('/:billId/shares/:shareId/pay', authorize('admin','employee'), payBillShare);
router.delete('/:id', authorize('admin'), deleteBill);
module.exports = router;
