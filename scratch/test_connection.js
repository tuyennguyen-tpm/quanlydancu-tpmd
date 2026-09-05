// Test kết nối với fetch trực tiếp
const url = 'https://pxnvgoqmtydqxljtiyinb.supabase.co';
const key = 'sb_publishable_IlXMJqlHdpVgSKMBB1PCwQ_als-0lLf';

async function testConnection() {
  console.log('Testing direct fetch to:', url);
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 200));
  } catch (e) {
    console.error('Fetch error:', e.message);
    console.error('Cause:', e.cause?.message);
  }
  
  // Thử ping endpoint health
  try {
    const res2 = await fetch(`${url}/rest/v1/wards?select=id&limit=1`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('\nWards endpoint status:', res2.status);
    const j = await res2.json();
    console.log('Result:', JSON.stringify(j).substring(0, 300));
  } catch (e2) {
    console.error('Wards fetch error:', e2.message, e2.cause?.message);
  }
}

testConnection();
