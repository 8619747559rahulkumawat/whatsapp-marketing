const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  const phones = ['918619747559', '919784657523', '917732837173'];
  for (const phone of phones) {
    const chat = await Chat.findOne({ waPhone: phone }).sort({ createdAt: -1 }).select('waName waPhone').lean();
    if (chat) {
      console.log(phone, '-> waName:', chat.waName);
    } else {
      console.log(phone, '-> NO CHAT DOC');
    }
  }
  mongoose.disconnect();
}).catch(e => console.error(e));
