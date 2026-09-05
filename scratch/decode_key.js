// Thử tìm project URL từ key mới
// Key mới: sb_publishable_IlXMJqlHdpVgSKMBB1PCwQ_als-0lLf
// Decode phần base64 của key để lấy project ref

const key = 'sb_publishable_IlXMJqlHdpVgSKMBB1PCwQ_als-0lLf';

// Tách phần sau sb_publishable_
const parts = key.split('_');
// Format mới: sb_publishable_<base64url>_<suffix>
// Thử decode phần giữa
const base64Part = parts.slice(2, -1).join('_');
console.log('Base64 part:', base64Part);

try {
  const decoded = Buffer.from(base64Part, 'base64url').toString('utf-8');
  console.log('Decoded:', decoded);
} catch (e) {
  console.log('Decode error:', e.message);
}

try {
  const decoded2 = Buffer.from(base64Part, 'base64').toString('utf-8');
  console.log('Decoded base64:', decoded2);
} catch (e) {
  console.log('Decode base64 error:', e.message);
}

// Supabase mới encode project ref vào key
// Pattern: IlXMJqlHdpVgSKMBB1PCwQ -> thử extract
const innerPart = 'IlXMJqlHdpVgSKMBB1PCwQ';
try {
  const buf = Buffer.from(innerPart, 'base64');
  console.log('Inner decoded hex:', buf.toString('hex'));
  console.log('Inner decoded utf8:', buf.toString('utf-8'));
} catch(e) {}
