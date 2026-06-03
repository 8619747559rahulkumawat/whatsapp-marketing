const http = require('http');
const fs = require('fs');

const imgPath = 'D:\\WhatsApp Marketing\\backend\\uploads\\test_upload.png';
const boundary = '----TestBoundary' + Math.random().toString(36).slice(2);
const imgBuf = fs.readFileSync(imgPath);

const header = '--' + boundary + '\r\n' +
  'Content-Disposition: form-data; name="file"; filename="test_upload.png"\r\n' +
  'Content-Type: image/png\r\n\r\n';

const footer = '\r\n--' + boundary + '--\r\n';

const bodyBuf = Buffer.concat([
  Buffer.from(header),
  imgBuf,
  Buffer.from(footer)
]);

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': bodyBuf.length
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Response:', data));
});
req.write(bodyBuf);
req.end();
