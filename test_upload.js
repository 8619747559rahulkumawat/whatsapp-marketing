const http = require('http');
const fs = require('fs');

// Login
const loginData = JSON.stringify({ email: 'admin@digitalsms.biz', password: 'Admin@123' });
const loginReq = http.request({
  hostname: 'localhost', port: 5000, path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
}, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const obj = JSON.parse(data);
    const tok = obj.token || (obj.data && obj.data.token);
    console.log('Login status:', res.statusCode);
    if (!tok) { console.log('No token', data); return; }
    console.log('Token obtained');

    // Upload with token
    const imgPath = 'D:/WhatsApp Marketing/backend/uploads/test_upload.png';
    const boundary = '----' + Math.random().toString(36).slice(2);
    const imgBuf = fs.readFileSync(imgPath);
    const header = '--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n';
    const footer = '\r\n--' + boundary + '--\r\n';
    const body = Buffer.concat([Buffer.from(header), imgBuf, Buffer.from(footer)]);

    const upReq = http.request({
      hostname: 'localhost', port: 5000, path: '/api/upload', method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length,
        'Authorization': 'Bearer ' + tok
      }
    }, upRes => {
      let d = '';
      upRes.on('data', c => d += c);
      upRes.on('end', () => console.log('Upload Status:', upRes.statusCode, 'Response:', d));
    });
    upReq.write(body);
    upReq.end();
  });
});
loginReq.write(loginData);
loginReq.end();
