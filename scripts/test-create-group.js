const fs = require('fs');
const path = require('path');

// Load the API handler
const handler = require(path.join(__dirname, '..', 'api', 'create-group.js'));

function makeReq(body) {
  const json = JSON.stringify(body);
  const stream = require('stream');
  const readable = new stream.Readable();
  readable._read = () => {};
  readable.push(json);
  readable.push(null);
  readable.method = 'POST';
  readable.headers = { 'content-type': 'application/json' };
  return readable;
}

function makeRes() {
  let statusCode = 200;
  let payload = null;
  return {
    status(code) { statusCode = code; return this; },
    json(obj) { payload = obj; console.log('STATUS:', statusCode); console.log('JSON:', JSON.stringify(obj, null, 2)); }
  };
}

(async () => {
  const req = makeReq({ name: 'Test', phone: '000', password: 'pass', groupName: 'G' });
  const res = makeRes();
  try {
    await handler(req, res);
  } catch (e) {
    console.error('Handler threw:', e);
  }
})();
