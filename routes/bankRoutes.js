const router = require('express').Router();
const { getBankLedger } = require('../controllers/bankController');
const { protect } = require('../middleware/auth');
router.get('/', protect, getBankLedger);
module.exports = router;
