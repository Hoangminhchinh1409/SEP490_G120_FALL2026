const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');

class DummyWS { }

console.log("Supabase URL:", supabaseUrl);
console.log(
    "Service role key exists:",
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
);
const supabase = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { persistSession: false },
        realtime: { transport: DummyWS }
    }
);

module.exports = supabase;