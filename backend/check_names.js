const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  const chats = await Chat.find({ waPhone: { $exists: true, $nin: ['', null] } }).sort({ createdAt: -1 }).limit(50);
  const phones = {};
  chats.forEach(c => {
    if (!phones[c.waPhone]) phones[c.waPhone] = { names: new Set(), count: 0 };
    phones[c.waPhone].count++;
    if (c.waName) phones[c.waPhone].names.add(c.waName);
  });
  for (const [phone, info] of Object.entries(phones)) {
    console.log(`Phone: ${phone} | Count: ${info.count} | Names: ${[...info.names].join(', ') || '(empty)'}`);
  }
  
  console.log('\n--- Checking Message collection for sent numbers ---');
  try {
    const Message = require('./models/Message');
    const msgs = await Message.find({}).sort({ createdAt: -1 }).limit(100);
    const seen = new Set();
    msgs.forEach(m => {
      const phone = (m.to || '').replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
      if (!seen.has(phone)) {
        seen.add(phone);
        console.log(`Sent to: ${phone} | Status: ${m.status} | Content: ${(m.content || '').slice(0,30)}`);
      }
    });
  } catch(e) { console.log('Error:', e.message); }
  mongoose.disconnect();
}).catch(e => console.error(e.message));
