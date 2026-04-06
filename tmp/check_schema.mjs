import fetch from 'node-fetch';

const SUPABASE_URL = 'https://vkeshyusimduiwjaijjv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrZXNoeXVzaW1kdWl3amFpamp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NDQ5NzcsImV4cCI6MjA4MzEyMDk3N30.54dikLQBkzT2dBJzuupaVcK3_vlchWVI08TQ2cxCgJw';

async function checkSchema() {
  const query = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ticto_pedidos'
    ORDER BY column_name;
  `;
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ sql: query })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Error fetching schema:', error);
    
    // If rpc/exec_sql doesn't exist, try direct REST query on columns (if exposed)
    // Actually, usually we can't query information_schema via PostgREST easily.
    // Let's try to just select one row and see the keys.
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/ticto_pedidos?limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (res2.ok) {
      const data = await res2.json();
      console.log('Available columns (from sample row):', Object.keys(data[0]));
    } else {
      console.error('Error fetching sample row:', await res2.text());
    }
    return;
  }

  const data = await response.json();
  console.log('Schema:', data);
}

checkSchema();
