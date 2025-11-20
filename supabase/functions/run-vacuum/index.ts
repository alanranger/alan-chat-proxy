import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get service role key from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Try multiple sources for database password
    // Note: Supabase doesn't allow secrets starting with SUPABASE_ prefix
    // So we use DB_PASSWORD instead
    let dbPassword = Deno.env.get("DB_PASSWORD") || 
                     Deno.env.get("DATABASE_PASSWORD") ||
                     Deno.env.get("POSTGRES_PASSWORD");
    
    // If not found, try extracting from SUPABASE_DB_URL or DATABASE_URL if they exist
    if (!dbPassword) {
      const supabaseDbUrl = Deno.env.get("SUPABASE_DB_URL");
      const databaseUrl = Deno.env.get("DATABASE_URL") || supabaseDbUrl;
      if (databaseUrl) {
        const urlMatch = databaseUrl.match(/postgres(?:ql)?:\/\/[^:]+:([^@]+)@/);
        if (urlMatch) {
          dbPassword = decodeURIComponent(urlMatch[1]);
          console.log("Extracted password from DATABASE_URL/SUPABASE_DB_URL");
        }
      }
    }
    
    console.log(`Password found: ${dbPassword ? 'YES' : 'NO'}, length: ${dbPassword?.length || 0}`);
    
    const projectRef = Deno.env.get("SUPABASE_PROJECT_REF") || 
                       supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || 
                       'igzvwbvgvmzvvzoclufx';

    if (!dbPassword) {
      // Log all available env vars (without sensitive values) for debugging
      const envKeys = Object.keys(Deno.env.toObject()).filter(k => 
        k.includes('SUPABASE') || k.includes('DATABASE') || k.includes('POSTGRES')
      );
      console.error("Available environment variables:", envKeys);
      throw new Error(`Database password not found. Available env vars: ${envKeys.join(', ')}. Please set DB_PASSWORD in Supabase Dashboard → Edge Functions → run-vacuum → Settings → Secrets.`);
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get list of tables to vacuum
    const { data: tablesData, error: tablesError } = await supabase.rpc("database_maintenance_tables");
    
    if (tablesError) {
      throw new Error(`Failed to get tables list: ${tablesError.message}`);
    }

    // Extract tables array
    let tables: string[] = [];
    if (Array.isArray(tablesData)) {
      tables = tablesData;
    } else if (tablesData?.tables && Array.isArray(tablesData.tables)) {
      tables = tablesData.tables;
    } else if (typeof tablesData === 'object') {
      const values = Object.values(tablesData);
      if (values.length > 0 && Array.isArray(values[0])) {
        tables = values[0];
      }
    }

    if (!tables || tables.length === 0) {
      throw new Error("No tables to vacuum");
    }

    // Connect directly to PostgreSQL using pg library
    // We'll use Deno's built-in fetch to call a PostgreSQL connection
    // Actually, we need to use a PostgreSQL client library
    // Let's use the Supabase REST API to execute SQL directly
    
    // Construct connection string
    const trimmedPassword = dbPassword.trim();
    const encodedPassword = encodeURIComponent(trimmedPassword);
    const connectionString = `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;
    
    console.log(`Connecting to database (project: ${projectRef}, password length: ${trimmedPassword.length}, encoded: ${encodedPassword !== trimmedPassword})`);

    // Use Deno's PostgreSQL client
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    
    const client = new Client(connectionString);
    
    try {
      await client.connect();
      console.log("Successfully connected to database");
    } catch (connectErr: any) {
      console.error("Connection error details:", {
        message: connectErr.message,
        code: connectErr.code,
        detail: connectErr.detail,
        hint: connectErr.hint
      });
      throw connectErr;
    }

    const results = {
      success: [] as string[],
      errors: [] as string[],
    };

    for (const table of tables) {
      try {
        // Escape table name
        const escapedTable = `"${table.replace(/"/g, '""')}"`;
        await client.queryObject(`VACUUM ANALYZE ${escapedTable}`);
        results.success.push(table);
        console.log(`Successfully vacuumed ${table}`);
      } catch (err: any) {
        const errorMsg = `Failed to vacuum ${table}: ${err.message}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    await client.end();

    return new Response(
      JSON.stringify({
        ok: true,
        message: `VACUUM completed: ${results.success.length} succeeded, ${results.errors.length} failed`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error running VACUUM:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || "Failed to run VACUUM",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

