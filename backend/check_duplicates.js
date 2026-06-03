const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  const chats = await Chat.find({ waPhone: { $exists: true, $nin: ['', null] } }).sort({ createdAt: -1 });
  console.log('Total Chat documents with waPhone:', chats.length);
  const countByPhone = {};
  chats.forEach(c => {
    countByPhone[c.waPhone] = (countByPhone[c.waPhone] || 0) + 1;
  });
  for (const [phone, count] of Object.entries(countByPhone)) {
    console.log(phone, '->', count, 'documents');
  }
  mongoose.disconnect();
}).catch(e => console.error(e));
