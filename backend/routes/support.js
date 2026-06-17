const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { auth, adminOnly } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/my', supportController.getTickets);
router.get('/all', supportController.getTickets);
router.post('/', supportController.createTicket);
router.put('/:id/status', supportController.updateTicketStatus);
router.put('/:id/assign', adminOnly, supportController.assignTicket);
router.post('/:id/notes', supportController.addTicketNote);
router.get('/agent-performance', supportController.getAgentPerformance);
router.get('/analytics', supportController.getInboxAnalytics);

module.exports = router;
