// Re-import workshop events CSV with fixed category parsing
import fs from 'fs';

const CSV_FILE = 'CSVSs from website/03 - www-alanranger-com__5013f4b2c4aaa4752ac69b17__photographic-workshops-near-me.csv';
const API_URL = 'https://alan-chat-proxy.vercel.app/api/csv-import';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

async function reImportWorkshopEvents() {
  try {
    console.log('🔄 Re-importing workshop events CSV with fixed category parsing...');
    
    // Read CSV file
    const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
    const csvData = csvContent; // API expects plain text, not base64
    
    // Prepare request body
    const body = {
      csvData: csvData,
      contentType: 'metadata',
      csvType: 'workshop_events'
    };
    
    console.log(`📁 CSV file: ${CSV_FILE}`);
    console.log(`📊 CSV size: ${csvContent.length} characters`);
    console.log(`🔗 API URL: ${API_URL}`);
    
    // Make API call
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify(body)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Import successful!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Import failed!');
      console.log(`Status: ${response.status}`);
      console.log(JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

reImportWorkshopEvents();
