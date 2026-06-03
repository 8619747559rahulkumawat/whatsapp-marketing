const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  // Find all waPhone values
  const phones = await Chat.distinct('waPhone', { waPhone: { $exists: true, $nin: ['', null] } });
  console.log('Unique waPhones:', phones);

  // For each phone, check if any doc has a message (real chat)
  for (const phone of phones) {
    const total = await Chat.countDocuments({ waPhone: phone });
    const withMsg = await Chat.countDocuments({ waPhone: phone, message: { $ne: '' } });
    const withoutMsg = total - withMsg;
    console.log(`${phone}: ${total} total, ${withMsg} with messages, ${withoutMsg} without messages`);
  }

  // Remove Chat docs that have empty message and were created by profile upsert
  const deleteResult = await Chat.deleteMany({ waPhone: { $exists: true, $nin: ['', null] }, message: '', senderName: '' });
  console.log(`\nDeleted ${deleteResult.deletedCount} empty upserted Chat documents`);

  // Verify remaining
  const remaining = await Chat.countDocuments({ waPhone: { $exists: true, $nin: ['', null] } });
  console.log(`Remaining Chat documents with waPhone: ${remaining}`);
  
  mongoose.disconnect();
}).catch(e => console.error(e));
