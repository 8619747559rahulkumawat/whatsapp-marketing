const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth);
router.use(tenantMiddleware);

router.get('/', meetingController.getMeetings);
router.post('/', meetingController.createMeeting);
router.get('/:id', meetingController.getMeeting);
router.put('/:id', meetingController.updateMeeting);
router.delete('/:id', meetingController.deleteMeeting);

module.exports = router;
