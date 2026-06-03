const Survey = require('../models/Survey');
const { SurveyResponse } = require('../models/Survey');

exports.getSurveys = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const surveys = await Survey.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, surveys });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSurvey = async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
    res.json({ success: true, survey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSurvey = async (req, res) => {
  try {
    const survey = await Survey.create({
      ...req.body, tenantId: req.tenant._id, userId: req.user._id
    });
    res.status(201).json({ success: true, survey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSurvey = async (req, res) => {
  try {
    const survey = await Survey.findByIdAndUpdate(
      req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!survey) return res.status(404).json({ success: false, message: 'Survey not found' });
    res.json({ success: true, survey });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSurvey = async (req, res) => {
  try {
    await Survey.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Survey deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitResponse = async (req, res) => {
  try {
    const survey = await Survey.findById(req.params.id);
    if (!survey || survey.status !== 'active') return res.status(404).json({ success: false, message: 'Survey not found or inactive' });
    const { answers, contactId } = req.body;
    let npsScore = null;
    const npsQuestion = survey.questions.find((q, i) => q.type === 'rating' && i === 0);
    if (npsQuestion && answers?.[0]?.score !== undefined) {
      npsScore = answers[0].score;
    }
    const response = await SurveyResponse.create({
      tenantId: req.tenant._id, surveyId: survey._id, contactId, answers, npsScore
    });
    const stats = await SurveyResponse.aggregate([
      { $match: { surveyId: survey._id } },
      { $group: { _id: null, avg: { $avg: '$npsScore' }, count: { $sum: 1 } } }
    ]);
    await Survey.findByIdAndUpdate(survey._id, {
      responseCount: stats[0]?.count || 0,
      averageScore: Math.round((stats[0]?.avg || 0) * 10) / 10
    });
    res.status(201).json({ success: true, response });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getResponses = async (req, res) => {
  try {
    const responses = await SurveyResponse.find({ tenantId: req.tenant._id, surveyId: req.params.id })
      .populate('contactId', 'name phone')
      .sort({ submittedAt: -1 });
    res.json({ success: true, responses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
