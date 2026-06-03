const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', goalController.getGoals);
router.post('/', goalController.createGoal);
router.get('/:id', goalController.getGoal);
router.put('/:id', goalController.updateGoal);
router.delete('/:id', goalController.deleteGoal);

module.exports = router;
