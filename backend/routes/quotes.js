const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth);
router.use(tenantMiddleware);

router.get('/', quoteController.getQuotes);
router.post('/', quoteController.createQuote);
router.get('/:id', quoteController.getQuote);
router.put('/:id', quoteController.updateQuote);
router.patch('/:id/status', quoteController.updateQuoteStatus);
router.delete('/:id', quoteController.deleteQuote);

module.exports = router;
