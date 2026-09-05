// Test DNS và kết nối của nhiều project Supabase
const projects = [
  { id: 'pxnvgoqmtydqxljtiyinb', key: 'sb_publishable_IlXMJqlHdpVgSKMBB1PCwQ_als-0lLf', name: 'TDP-QuangGiao (mới nhất)' },
  { id: 'yvtmckpdpinipxyvphdm', key: 'sb_publishable_2Zkgkwp7OmzMUH_j7mUD5w_migssOX8', name: 'Project trước' },
  { id: 'zebrotqycenybmovptwl', key: '', name: 'Project zebrotq (cũ nhất)' },
];

async function testProject(p) {
  const url = `https://${p.id}.supabase.co`;
  try {
    const res = await fetch(`${url}/rest/v1/wards?select=id&limit=1`, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'apikey': p.key,
        'Authorization': `Bearer ${p.key}`,
      }
    });
    const text = await res.text();
    console.log(`[${p.name}] Status: ${res.status} | Body: ${text.substring(0, 100)}`);
  } catch (e) {
    console.log(`[${p.name}] ERROR: ${e.message} | Cause: ${e.cause?.message || 'N/A'}`);
  }
}

async function main() {
  for (const p of projects) {
    await testProject(p);
  }
}

main();
