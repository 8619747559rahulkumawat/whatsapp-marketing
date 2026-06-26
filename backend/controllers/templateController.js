const Template = require('../models/Template');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');

exports.getTemplates = async (req, res) => {
  try {
    const { category, status, page = 1, limit = 20 } = req.query;
    const filter = { tenantId: req.tenant._id };
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      filter.userId = req.user._id;
    }
    
    if (category) filter.category = category;
    if (status) filter.status = status;
    
    const skip = (page - 1) * limit;
    
    const [templates, total] = await Promise.all([
      Template.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Template.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      templates,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, category, content, variables = [], language = 'en' } = req.body;
    
    // Validate required fields
    if (!name || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and content are required' 
      });
    }
    
    // Extract variables from content if not provided
    const extractedVariables = [...new Set(content.match(/{{\d+}}/g) || [])]
      .map(v => v.replace(/[{}]/g, ''));
    
    const finalVariables = variables.length > 0 ? variables : extractedVariables;
    
    const template = await Template.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      name,
      category: category || 'general',
      content,
      variables: finalVariables,
      language
    });
    
    res.status(201).json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const template = await Template.findOne({
      _id: req.params.id,
      tenantId: req.tenant._id,
      userId: req.user._id
    });
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }
    
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { name, category, content, variables, language, status } = req.body;
    
    // Prevent modification of approved templates except for status
    const existingTemplate = await Template.findOne({
      _id: req.params.id,
      tenantId: req.tenant._id,
      userId: req.user._id
    });
    
    if (!existingTemplate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }
    
    if (existingTemplate.status === 'approved' && 
        (!status || status === 'approved')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Approved templates cannot be modified' 
      });
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined) {
      updateData.content = content;
      // Update variables based on new content if variables not explicitly provided
      if (variables === undefined) {
        const extractedVariables = [...new Set(content.match(/{{\d+}}/g) || [])]
          .map(v => v.replace(/[{}]/g, ''));
        updateData.variables = extractedVariables;
      }
    }
    if (variables !== undefined) updateData.variables = variables;
    if (language !== undefined) updateData.language = language;
    if (status !== undefined) updateData.status = status;
    
    // Set approvedAt timestamp when template is approved
    if (status === 'approved' && existingTemplate.status !== 'approved') {
      updateData.approvedAt = new Date();
    }
    
    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id, userId: req.user._id },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenant._id,
      userId: req.user._id
    });
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }
    
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitForApproval = async (req, res) => {
  try {
    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id, userId: req.user._id, status: 'draft' },
      { $set: { status: 'pending_approval' } },
      { new: true }
    );
    
    if (!template) {
      return res.status(400).json({ 
        success: false, 
        message: 'Template not found or cannot be submitted for approval' 
      });
    }
    
    // In a real implementation, this would send the template to WhatsApp Business API for approval
    // For now, we'll just update the status
    
    res.json({ 
      success: true, 
      message: 'Template submitted for approval', 
      template 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveTemplate = async (req, res) => {
  try {
    // Only super admin or tenant admin can approve templates
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions to approve templates' 
      });
    }
    
    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { 
        $set: { 
          status: 'approved',
          approvedAt: new Date()
        } 
      },
      { new: true }
    );
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Template approved successfully', 
      template 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectTemplate = async (req, res) => {
  try {
    // Only super admin or tenant admin can reject templates
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions to reject templates' 
      });
    }
    
    const { reason } = req.body;
    
    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { 
        $set: { 
          status: 'rejected',
          rejectedReason: reason || 'Rejected by administrator'
        } 
      },
      { new: true }
    );
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Template rejected successfully', 
      template 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      filter.userId = req.user._id;
    }
    const categories = await Template.distinct('category', filter);
    
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTemplatesByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status parameter is required' 
      });
    }
    
    const filter = { tenantId: req.tenant._id, status };
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      filter.userId = req.user._id;
    }
    const templates = await Template.find(filter).sort({ createdAt: -1 });
    
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};