const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  const result = await Chat.aggregate([
    { $match: { waPhone: { $exists: true, $nin: ['', null] } } },
    { $group: { _id: '$waPhone', count: { $sum: 1 }, name: { $first: '$waName' }, pic: { $first: '$profilePic' } } }
  ]);
  console.log('Unique phones in Chat collection:');
  result.forEach(r => console.log('  Phone:', r._id, '| Name:', r.name || '(empty)', '| Pic:', r.pic ? 'YES' : 'NO', '| Msgs:', r.count));

  console.log('\n--- Checking customer collection ---');
  try {
    const Customer = require('./models/Customer');
    const customers = await Customer.find({}).limit(10);
    console.log('Customers:', customers.length);
    customers.forEach(c => console.log('  Phone:', c.phone, '| Name:', c.name));
  } catch(e) { console.log('No Customer model:', e.message); }

  console.log('\n--- Checking Message collection ---');
  try {
    const Message = require('./models/Message');
    const msgs = await Message.find({}).sort({ createdAt: -1 }).limit(20);
    const seenPhones = new Set();
    msgs.forEach(m => {
      const phone = (m.to || '').replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
      if (!seenPhones.has(phone)) {
        seenPhones.add(phone);
        console.log('  To:', phone, '| Content:', (m.content || '').slice(0, 30));
      }
    });
  } catch(e) { console.log('Message model error:', e.message); }

  mongoose.disconnect();
}).catch(e => console.error(e.message));
