const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
router.use(auth);
router.use(tenantMiddleware);

router.get('/', teamController.getTeamMembers);
router.post('/', teamController.addTeamMember);
router.put('/:id', teamController.updateTeamMember);
router.delete('/:id', teamController.removeTeamMember);
router.post('/assign-chat', teamController.assignChat);
router.post('/internal-note', teamController.addInternalNote);
router.get('/shared-inbox', teamController.getSharedInbox);

module.exports = router;
