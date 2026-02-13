const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  }
});
const spec = await resp.json();
const paths = Object.keys(spec.paths || {});
const rpc = paths.filter(p => p.includes('rpc'));
const tables = paths.filter(p => !p.includes('rpc') && p.startsWith('/')).map(p => p.slice(1));
console.log('RPC endpoints:', rpc.length ? rpc : 'NONE');
console.log('Tables:', tables);
