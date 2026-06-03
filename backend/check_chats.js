const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  const chats = await Chat.find({ waPhone: { $exists: true, $nin: ['', null] } }).sort({ createdAt: -1 }).limit(20);
  console.log('Total waPhone chats:', chats.length);
  const seen = new Set();
  chats.forEach(c => {
    if (!seen.has(c.waPhone)) {
      seen.add(c.waPhone);
      console.log('Phone:', c.waPhone, '| Name:', c.waName || '(empty)', '| Pic:', c.profilePic ? 'YES' : 'NO', '| PicURL:', (c.profilePic || '').slice(0, 50));
    }
  });
  mongoose.disconnect();
}).catch(e => console.error(e.message));
