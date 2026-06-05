const Compliance = require('../models/Compliance');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { formatPhoneNumber } = require('../utils/helpers');

exports.logComplianceEvent = async (req, res) => {
  try {
    const { contactId, type, method, keyword, details, gdprRequestType } = req.body;
    
    // Validate required fields
    if (!contactId || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Contact ID and type are required' 
      });
    }
    
    // Verify contact belongs to user and tenant
    const contact = await Contact.findOne({
      _id: contactId,
      userId: req.user._id,
      tenantId: req.tenant._id
    });
    
    if (!contact) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contact not found' 
      });
    }
    
    // Create compliance record
    const complianceData = {
      tenantId: req.tenant._id,
      userId: req.user._id,
      contactId: contactId,
      type: type,
      phone: contact.phone,
      method: method || 'manual',
      keyword: keyword || '',
      details: details || {},
      gdprRequestType: gdprRequestType || null
    };
    
    const complianceRecord = await Compliance.create(complianceData);
    
    // Process certain compliance events immediately
    if (type === 'opt_out' || (keyword && ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT'].includes(keyword.toUpperCase()))) {
      // Opt-out the contact
      await Contact.findByIdAndUpdate(contactId, {
        isBlacklisted: true,
        blacklistReason: `Opted out via ${method}${keyword ? ` with keyword '${keyword}'` : ''}`
      });
      
      // Mark compliance as processed
      await Compliance.findByIdAndUpdate(complianceRecord._id, {
        processed: true,
        processedAt: new Date()
      });
    } else if (type === 'opt_in' || type === 'consent_given' || (keyword && ['START', 'YES', 'UNSTOP', 'SUBSCRIBE'].includes(keyword.toUpperCase()))) {
      await Contact.findByIdAndUpdate(contactId, {
        isBlacklisted: false,
        blacklistReason: ''
      });

      await Compliance.findByIdAndUpdate(complianceRecord._id, {
        processed: true,
        processedAt: new Date()
      });
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Compliance event logged successfully',
      compliance: complianceRecord 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getComplianceLogs = async (req, res) => {
  try {
    const { type, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { 
      tenantId: req.tenant._id,
      userId: req.user._id 
    };
    
    if (type) filter.type = type;
    if (startDate) filter.timestamp = { ...filter.timestamp, $gte: new Date(startDate) };
    if (endDate) filter.timestamp = { ...filter.timestamp, $lte: new Date(endDate) };
    
    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      Compliance.find(filter)
        .populate('contactId', 'name phone')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Compliance.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      logs,
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

exports.checkDND = async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }
    
    // Format the phone number for consistent checking
    const formattedPhone = formatPhoneNumber(phone);
    
    // Check latest consent state for this phone number in this tenant.
    const dndRecord = await Compliance.findOne({
      tenantId: req.tenant._id,
      phone: formattedPhone,
      type: { $in: ['opt_in', 'opt_out', 'consent_given', 'consent_withdrawn'] },
      processed: true
    }).sort({ timestamp: -1 });
    
    const isDND = dndRecord?.type === 'opt_out' || dndRecord?.type === 'consent_withdrawn';
    
    res.json({
      success: true,
      isDND,
      phone: formattedPhone,
      dndRecord: isDND ? dndRecord : null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.processKeywordMessage = async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number and message are required' 
      });
    }
    
    // Format the phone number
    const formattedPhone = formatPhoneNumber(phone);
    
    // Find contact by phone number in this tenant
    const contact = await Contact.findOne({
      tenantId: req.tenant._id,
      phone: formattedPhone
    });
    
    if (!contact) {
      // If contact doesn't exist, we still want to log the compliance attempt
      // but we can't associate it with a specific contact
      return res.status(404).json({ 
        success: false, 
        message: 'Contact not found' 
      });
    }
    
    // Check for STOP keywords
    const stopKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'];
    const startKeywords = ['START', 'YES', 'UNSTOP', 'SUBSCRIBE'];
    
    const messageUpper = message.trim().toUpperCase();
    let keywordType = null;
    let keyword = null;
    
    // Check for exact keyword matches
    if (stopKeywords.includes(messageUpper)) {
      keywordType = 'opt_out';
      keyword = messageUpper;
    } else if (startKeywords.includes(messageUpper)) {
      keywordType = 'opt_in';
      keyword = messageUpper;
    }
    
    // If we found a keyword, log the compliance event
    if (keywordType) {
      const complianceData = {
        tenantId: req.tenant._id,
        userId: contact.userId, // Use the contact's owner as the user
        contactId: contact._id,
        type: keywordType,
        phone: formattedPhone,
        method: 'keyword',
        keyword: keyword,
        details: {
          originalMessage: message,
          processedAt: new Date().toISOString()
        }
      };
      
      const complianceRecord = await Compliance.create(complianceData);
      
      if (keywordType === 'opt_out') {
        await Contact.findByIdAndUpdate(contact._id, {
          isBlacklisted: true,
          blacklistReason: `Opted out via keyword: ${keyword}`
        });
      } else if (keywordType === 'opt_in') {
        await Contact.findByIdAndUpdate(contact._id, {
          isBlacklisted: false,
          blacklistReason: ''
        });
      }

      await Compliance.findByIdAndUpdate(complianceRecord._id, {
        processed: true,
        processedAt: new Date()
      });
      
      return res.json({
        success: true,
        message: `Keyword '${keyword}' processed successfully`,
        compliance: complianceRecord
      });
    }
    
    // No compliance keyword found
    return res.json({
      success: true,
      message: 'No compliance keywords detected in message',
      compliance: null
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.gdprRequest = async (req, res) => {
  try {
    const { contactId, requestType } = req.body;
    
    if (!contactId || !requestType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Contact ID and request type are required' 
      });
    }
    
    // Validate request type
    const validRequestTypes = ['access', 'export', 'deletion', 'rectification'];
    if (!validRequestTypes.includes(requestType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid GDPR request type' 
      });
    }
    
    // Verify contact belongs to user and tenant
    const contact = await Contact.findOne({
      _id: contactId,
      userId: req.user._id,
      tenantId: req.tenant._id
    });
    
    if (!contact) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contact not found' 
      });
    }
    
    // Create GDPR compliance record
    const complianceData = {
      tenantId: req.tenant._id,
      userId: req.user._id,
      contactId: contactId,
      type: 'gdpr_request',
      phone: contact.phone,
      method: 'api',
      gdprRequestType: requestType,
      gdprStatus: 'pending',
      details: {
        requestedAt: new Date().toISOString(),
        requestedBy: req.user._id
      }
    };
    
    const complianceRecord = await Compliance.create(complianceData);
    
    // Process different GDPR request types
    switch (requestType) {
      case 'access':
        // Return contact data
        res.json({
          success: true,
          message: 'GDPR access request initiated',
          compliance: complianceRecord,
          data: {
            contact: {
              id: contact._id,
              phone: contact.phone,
              name: contact.name,
              email: contact.email,
              address: contact.address,
              tags: contact.tags,
              groups: contact.groups,
              variables: contact.variables,
              isBlacklisted: contact.isBlacklisted,
              blacklistReason: contact.blacklistReason,
              lastMessaged: contact.lastMessaged,
              createdAt: contact.createdAt,
              updatedAt: contact.updatedAt
            }
          }
        });
        break;
        
      case 'export':
        // In a real implementation, this would generate a file and store it
        // For now, we'll just mark it as processing
        await Compliance.findByIdAndUpdate(complianceRecord._id, {
          gdprStatus: 'processing'
        });
        
        res.json({
          success: true,
          message: 'GDPR export request initiated',
          compliance: complianceRecord
        });
        break;
        
      case 'deletion':
        // In a real implementation, this would delete or anonymize the contact
        // For now, we'll just mark it as processing
        await Compliance.findByIdAndUpdate(complianceRecord._id, {
          gdprStatus: 'processing'
        });
        
        res.json({
          success: true,
          message: 'GDPR deletion request initiated',
          compliance: complianceRecord
        });
        break;
        
      case 'rectification':
        // For rectification, we'd expect additional data in the request
        // For now, we'll just acknowledge the request
        await Compliance.findByIdAndUpdate(complianceRecord._id, {
          gdprStatus: 'processing'
        });
        
        res.json({
          success: true,
          message: 'GDPR rectification request initiated',
          compliance: complianceRecord
        });
        break;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getGDPRRequestStatus = async (req, res) => {
  try {
    const { complianceId } = req.params;
    
    const complianceRecord = await Compliance.findOne({
      _id: complianceId,
      tenantId: req.tenant._id,
      userId: req.user._id,
      type: 'gdpr_request'
    });
    
    if (!complianceRecord) {
      return res.status(404).json({ 
        success: false, 
        message: 'GDPR request not found' 
      });
    }
    
    res.json({
      success: true,
      compliance: complianceRecord
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

