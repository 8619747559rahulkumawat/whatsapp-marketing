const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/my', auth, supportController.getTickets);
router.get('/all', auth, supportController.getTickets);
router.post('/', auth, supportController.createTicket);
router.put('/:id/status', auth, supportController.updateTicketStatus);
router.put('/:id/assign', auth, adminOnly, supportController.assignTicket);
router.post('/:id/notes', auth, supportController.addTicketNote);
router.get('/agent-performance', auth, supportController.getAgentPerformance);
router.get('/analytics', auth, supportController.getInboxAnalytics);

module.exports = router;
