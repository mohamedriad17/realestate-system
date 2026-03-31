const router = require('express').Router();
const { getTenants } = require('../controllers/tenantController');
const { protect } = require('../middleware/auth');
router.get('/', protect, getTenants);
module.exports = router;
