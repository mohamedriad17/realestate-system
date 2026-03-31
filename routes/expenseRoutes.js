const router = require('express').Router();
const { getExpenses, createExpense, deleteExpense } = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');
router.use(protect);
router.get('/', getExpenses);
router.post('/', authorize('admin','employee'), createExpense);
router.delete('/:id', authorize('admin'), deleteExpense);
module.exports = router;
