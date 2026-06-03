const http = require('http');
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/whatsapp-marketing').then(async () => {
  const Chat = require('./models/Chat');
  const msg = await Chat.findOne({ waPhone: { $exists: true } }).sort({ createdAt: -1 });
  if (!msg) { console.log('No msg found'); process.exit(); return; }

  const body = JSON.stringify({ email: 'admin@digitalsms.biz', password: 'Admin@123' });
  const req = http.request({ hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const t = JSON.parse(data).token;
      console.log('Deleting msg:', msg._id, 'waPhone:', msg.waPhone);
      const del = http.request({ hostname: '127.0.0.1', port: 5000, path: '/api/chat/' + msg._id, method: 'DELETE', headers: { 'Authorization': 'Bearer ' + t } }, r2 => {
        let d2 = '';
        r2.on('data', c => d2 += c);
        r2.on('end', () => { console.log('Result:', d2); process.exit(); });
      });
      del.end();
    });
  });
  req.write(body);
  req.end();
}).catch(e => { console.error(e); process.exit(); });
