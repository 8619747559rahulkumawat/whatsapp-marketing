const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  const result = await Chat.aggregate([
    { $match: { waPhone: { $exists: true, $nin: ['', null] } } },
    { $group: { _id: '$waPhone', count: { $sum: 1 }, hasMessage: { $max: { $cond: [{ $ne: ['$message', ''] }, true, false] } } } },
    { $sort: { _id: 1 } }
  ]);
  result.forEach(r => console.log(r._id, 'count:', r.count, 'hasMsg:', r.hasMessage));
  mongoose.disconnect();
}).catch(e => console.error(e));
