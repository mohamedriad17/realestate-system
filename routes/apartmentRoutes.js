const router = require('express').Router();
const { getApartments, getApartment, updateApartment, deleteApartment } = require('../controllers/apartmentController');
const { protect, authorize } = require('../middleware/auth');
router.use(protect);
router.get('/', getApartments);
router.get('/:id', getApartment);
router.put('/:id', authorize('admin','employee'), updateApartment);
router.delete('/:id', authorize('admin'), deleteApartment);
module.exports = router;
