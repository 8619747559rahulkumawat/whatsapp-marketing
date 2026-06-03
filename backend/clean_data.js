const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  // Find all chats where waName is just a phone number (all digits, no letters)
  const result = await Chat.updateMany(
    { waName: { $regex: /^\d+$/ } },
    { $set: { waName: '' } }
  );
  console.log(`Cleaned ${result.modifiedCount} chats with numeric waName`);

  // Also clean profilePic that might be empty or placeholder
  const result2 = await Chat.updateMany(
    { profilePic: { $in: ['', null, 'undefined'] } },
    { $unset: { profilePic: '' } }
  );
  console.log(`Cleaned ${result2.modifiedCount} chats with empty/placeholder profilePic`);

  // Verify
  const chats = await Chat.find({ waPhone: { $exists: true, $nin: ['', null] } }).sort({ createdAt: -1 });
  const seen = new Set();
  chats.forEach(c => {
    if (!seen.has(c.waPhone)) {
      seen.add(c.waPhone);
      console.log(`Phone: ${c.waPhone} | waName: '${c.waName || '(empty)'}' | profilePic: ${c.profilePic ? 'YES' : 'NO'}`);
    }
  });
  mongoose.disconnect();
}).catch(e => console.error(e.message));
