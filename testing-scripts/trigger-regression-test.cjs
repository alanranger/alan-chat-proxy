const fs = require('fs');
const path = require('path');

// Try multiple env file locations
const envFiles = ['.env.local', '.env', '.env.production'];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    require('dotenv').config({ path: envFile });
    break;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function triggerRegressionTest() {
  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/run-40q-regression-test`;
  
  console.log('🔄 Triggering 40Q regression test...');
  console.log(`URL: ${edgeFunctionUrl}`);
  
  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        job_id: 999,
        job_name: 'Manual Regression Test',
        test_phase: 'after'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error:', data);
      process.exit(1);
    }
    
    console.log('✅ Regression test triggered successfully!');
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.test_run_id) {
      console.log(`\n📊 Test Run ID: ${data.test_run_id}`);
      console.log('⏳ Test is running. Check the cron dashboard for results.');
    }
  } catch (error) {
    console.error('❌ Error triggering test:', error.message);
    process.exit(1);
  }
}

triggerRegressionTest();

