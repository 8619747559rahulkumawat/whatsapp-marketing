const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
// Apply auth and tenant middleware to all routes
router.use(auth);
router.use(tenantMiddleware);

router.get('/', contactController.getContacts);
router.post('/', contactController.createContact);
router.get('/tags/stats', contactController.getTagStats);
router.get('/variables', contactController.getContactVariables);
router.get('/export/:format', contactController.exportContacts);
router.post('/import', contactController.importContacts);

// Group scraping routes
router.get('/groups/scrapes', contactController.getGroupScrapes);
router.post('/groups/scrape', contactController.startGroupScrape);
router.post('/groups/scrape-all', contactController.scrapeAllGroups);
router.get('/groups/scrape/:id/members', contactController.getGroupScrapeMembers);
router.get('/groups/scrape/:id/export', contactController.exportGroupScrape);
router.post('/groups/scrape/:id/import', contactController.importGroupScrape);
router.delete('/groups/scrape/:id', contactController.deleteGroupScrape);

router.get('/:id', contactController.getContact);
router.put('/:id', contactController.updateContact);
router.delete('/:id', contactController.deleteContact);

module.exports = router;
