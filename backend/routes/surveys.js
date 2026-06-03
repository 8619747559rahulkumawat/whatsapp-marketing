const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', surveyController.getSurveys);
router.post('/', surveyController.createSurvey);
router.get('/:id', surveyController.getSurvey);
router.put('/:id', surveyController.updateSurvey);
router.delete('/:id', surveyController.deleteSurvey);
router.get('/:id/responses', surveyController.getResponses);

// Public submission (no auth)
const publicRouter = express.Router();
publicRouter.post('/:id/submit', surveyController.submitResponse);

module.exports = router;
module.exports.publicRouter = publicRouter;
