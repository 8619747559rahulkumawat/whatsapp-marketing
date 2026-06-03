const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', contractController.getContracts);
router.post('/', contractController.createContract);
router.get('/:id', contractController.getContract);
router.put('/:id', contractController.updateContract);
router.delete('/:id', contractController.deleteContract);

module.exports = router;
