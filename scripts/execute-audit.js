/**
 * Execute Complete Database Audit
 * Uses Supabase MCP tools to query database and generate comprehensive reports
 */

import { processAuditData } from './run-db-audit.js';

// Table data from the last SQL query result
// This will be populated with actual MCP query results
const tableData = [
  // Data will be inserted here from MCP query results
];

// Process and generate reports
if (tableData.length > 0) {
  processAuditData(tableData).catch(console.error);
} else {
  console.log('No table data available. Run MCP queries first.');
}

