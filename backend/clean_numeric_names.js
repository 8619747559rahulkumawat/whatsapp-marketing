const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  const result = await Chat.updateMany(
    { waName: { $regex: /^\d+$/ } },
    { $set: { waName: '' } }
  );
  console.log('Cleaned numeric waNames:', result.modifiedCount);

  const chats = await Chat.find({ waPhone: { $exists: true, $nin: ['', null] } }).sort({ createdAt: -1 });
  const seen = {};
  chats.forEach(c => {
    if (!seen[c.waPhone]) seen[c.waPhone] = c.waName;
  });
  for (const [phone, name] of Object.entries(seen)) {
    console.log(phone, '->', name || '(empty)');
  }
  mongoose.disconnect();
}).catch(e => console.error(e));
