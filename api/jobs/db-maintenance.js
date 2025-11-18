// api/jobs/db-maintenance.js
// API endpoint to trigger database maintenance
// POST /api/jobs/db-maintenance

// Note: Vercel serverless functions need to import from relative paths
// We'll inline the maintenance logic here to avoid import issues
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  // Optional: Add authentication check
  const authToken = req.headers.authorization?.replace('Bearer ', '') || 
                    req.query.token || 
                    req.body.token;

  const expectedToken = process.env.INGEST_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  
  if (expectedToken && authToken !== expectedToken) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token'
    });
  }

  try {
    // Set timeout for long-running operations
    res.setTimeout(300000); // 5 minutes (Vercel max)

    // Run maintenance
    const results = await runMaintenance();

    // Return results
    return res.status(200).json({
      success: true,
      message: 'Database maintenance completed',
      results: {
        chat_sessions_deleted: results.chat_sessions_deleted,
        chat_interactions_deleted: results.chat_interactions_deleted,
        page_html_deleted: results.page_html_deleted,
        backup_tables_dropped: results.backup_tables_dropped,
        errors: results.errors,
        error_count: results.errors.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database maintenance error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Database maintenance failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

