const mongoose = require('mongoose');

const surveyQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  type: { type: String, enum: ['rating', 'text', 'yesno', 'multiple'], default: 'rating' },
  options: [{ type: String }],
  order: { type: Number, default: 0 }
}, { _id: false });

const surveyResponseSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  answers: [{
    question: { type: String },
    answer: { type: mongoose.Schema.Types.Mixed },
    score: { type: Number }
  }],
  npsScore: { type: Number, min: 0, max: 10 },
  submittedAt: { type: Date, default: Date.now }
});

const surveySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['nps', 'csat', 'custom'], default: 'nps' },
  questions: [surveyQuestionSchema],
  status: { type: String, enum: ['draft', 'active', 'closed'], default: 'draft' },
  responseCount: { type: Number, default: 0 },
  averageScore: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

surveySchema.index({ tenantId: 1, userId: 1 });
surveyResponseSchema.index({ tenantId: 1, surveyId: 1 });

module.exports = mongoose.model('Survey', surveySchema);
module.exports.SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);
