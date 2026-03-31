const router = require('express').Router();
const { getUsers, updateStatus, updateRole, deleteUser } = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/auth');
router.use(protect, adminOnly);
router.get('/', getUsers);
router.patch('/:id/status', updateStatus);
router.patch('/:id/role', updateRole);
router.delete('/:id', deleteUser);
module.exports = router;
