// Test script to check if the API works with environment variables
import { createClient } from "@supabase/supabase-js";

// Set environment variables (you'll need to replace these with actual values)
process.env.SUPABASE_URL = "https://igzvwbvgvmzvvzoclufx.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key-here";

console.log("Testing Supabase connection...");

try {
  const client = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY, 
    { auth: { persistSession: false } }
  );
  
  console.log("✅ Supabase client created successfully");
  
  // Test a simple query
  const { data, error } = await client.from('page_entities').select('count').limit(1);
  
  if (error) {
    console.log("❌ Supabase query error:", error.message);
  } else {
    console.log("✅ Supabase query successful");
  }
  
} catch (error) {
  console.log("❌ Error creating Supabase client:", error.message);
}


