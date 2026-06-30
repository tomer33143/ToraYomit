const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔵 Supabase initialization:');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✅ SET' : '❌ MISSING');
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? '✅ SET (length: ' + SUPABASE_KEY.length + ')' : '❌ MISSING');

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    console.log('✅ Creating Supabase client...');
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    console.log('✅ Supabase client created successfully');
  } catch (err) {
    console.error('❌ Error creating Supabase client:', err);
    supabase = null;
  }
} else {
  console.error('❌ Supabase config missing — continuing with stub client to return JSON errors');

  const makeStubResult = () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });

  class StubQuery {
    select() { return this; }
    insert() { return this; }
    eq() { return this; }
    maybeSingle() { return makeStubResult(); }
    single() { return makeStubResult(); }
    then(resolve) { return makeStubResult().then(resolve); }
  }

  supabase = {
    from() { return new StubQuery(); }
  };
}

module.exports = { supabase };
