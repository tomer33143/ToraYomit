const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔵 Supabase initialization:');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✅ SET' : '❌ MISSING');
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? '✅ SET (length: ' + SUPABASE_KEY.length + ')' : '❌ MISSING');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const error = `❌ Missing Supabase config: URL=${!SUPABASE_URL}, KEY=${!SUPABASE_KEY}`;
  console.error(error);
  throw new Error(error);
}

console.log('✅ Creating Supabase client...');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

console.log('✅ Supabase client created successfully');
module.exports = { supabase };
