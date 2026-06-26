const Contact = require('../models/Contact');
const aiService = require('./aiService');

const captureEntity = async (message, contactId, tenantId, userId) => {
  const entities = await aiService.extractEntities(message);
  if (!entities) return { captured: false, entities: {} };

  const contact = await Contact.findOne({ _id: contactId, tenantId });
  if (!contact) return { captured: false, entities };

  const updates = {};
  if (entities.email && !contact.email) updates.email = entities.email;
  if (entities.phone && !contact.phone) updates.phone = entities.phone;
  if (entities.name && !contact.name) updates.name = entities.name;
  if (entities.city) {
    updates.city = entities.city;
    updates.address = contact.address
      ? `${contact.address}, ${entities.city}`
      : entities.city;
  }
  if (entities.orderId) {
    updates.variables = { ...(contact.variables || {}), lastOrderId: entities.orderId };
  }

  if (Object.keys(updates).length > 0) {
    await Contact.findByIdAndUpdate(contactId, { $set: updates });
    return { captured: true, entities, updates };
  }

  return { captured: false, entities };
};

const extractAndSaveToContact = async (message, phone, tenantId, userId) => {
  const entities = await aiService.extractEntities(message);
  if (!entities) return { captured: false, entities: {} };

  const contact = await Contact.findOne({ phone, tenantId });
  if (!contact) return { captured: false, entities };

  const updates = {};
  if (entities.email && !contact.email) updates.email = entities.email;
  if (entities.name && !contact.name) updates.name = entities.name;
  if (entities.city) {
    updates.city = entities.city;
    updates.address = contact.address
      ? `${contact.address}, ${entities.city}`
      : entities.city;
  }
  if (entities.orderId) {
    updates.variables = { ...(contact.variables || {}), lastOrderId: entities.orderId };
  }

  if (Object.keys(updates).length > 0) {
    await Contact.findByIdAndUpdate(contact._id, { $set: updates });
    return { captured: true, entities, updates };
  }

  return { captured: false, entities };
};

module.exports = { captureEntity, extractAndSaveToContact };
