require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

supabase.from('clientes').select('*').limit(1)
  .then(res => {
    console.log(res);
    process.exit(0);
  })
  .catch(console.error);
