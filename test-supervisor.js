const http = require('http');

const data = JSON.stringify({
  messages: [{role: 'user', content: 'hello test'}],
  resourceId: 'b78a9c8f-dc46-4ae1-83d3-7d2d3a3c9b78', // Random UUID
  moduleName: 'Test'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/supervisor',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
