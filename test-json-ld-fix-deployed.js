// Test script to verify the deployed JSON-LD fix
// Using built-in fetch

async function testJsonLdFixDeployed() {
  console.log('=== TESTING DEPLOYED JSON-LD FIX ===\n');
  
  const testUrl = 'https://www.alanranger.com/blog-on-photography/what-is-iso-in-photography';
  
  try {
    console.log('Testing JSON-LD extraction fix...');
    console.log('URL:', testUrl);
    
    // Test the ingest endpoint
    const response = await fetch('https://chat-ai-bot-eta.vercel.app/api/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INGEST_TOKEN || 'test-token'}`
      },
      body: JSON.stringify({
        url: testUrl,
        dryRun: false
      })
    });

    const result = await response.json();
    
    console.log('\n=== INGEST RESULT ===');
    console.log('Status:', response.status);
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Ingest completed successfully');
      console.log('Chunks:', result.chunks);
      console.log('Entities:', result.entities);
      console.log('JSON-LD Found:', result.jsonLdFound);
      
      if (result.jsonLdFound) {
        console.log('\n🎯 SUCCESS! JSON-LD extraction is now working!');
        console.log('The regex fix has resolved the extraction issue.');
      } else {
        console.log('\n⚠️  JSON-LD extraction still not working - may need further investigation');
      }
    } else {
      console.log('\n❌ Ingest failed');
      console.log('Error:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testJsonLdFixDeployed();
