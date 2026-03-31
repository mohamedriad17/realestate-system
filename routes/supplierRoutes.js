const router = require('express').Router();
const {
  getSuppliers, getSupplierDetail, createSupplier, updateSupplier, deleteSupplier,
  getOwners, getOwnerDetail, createOwner, updateOwner, deleteOwner
} = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Suppliers
router.get   ('/suppliers',             getSuppliers);
router.get   ('/suppliers/:id/detail',  getSupplierDetail);
router.post  ('/suppliers',             authorize('admin','employee'), createSupplier);
router.put   ('/suppliers/:id',         authorize('admin','employee'), updateSupplier);
router.delete('/suppliers/:id',         authorize('admin'),            deleteSupplier);

// Owners
router.get   ('/owners',                getOwners);
router.get   ('/owners/:id/detail',     getOwnerDetail);
router.post  ('/owners',                authorize('admin','employee'), createOwner);
router.put   ('/owners/:id',            authorize('admin','employee'), updateOwner);
router.delete('/owners/:id',            authorize('admin'),            deleteOwner);

module.exports = router;
