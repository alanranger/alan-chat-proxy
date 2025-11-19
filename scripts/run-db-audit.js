/**
 * Complete Database Audit Script
 * Connects to Supabase, analyzes all 133 tables, and generates comprehensive reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script will use Supabase MCP tools via a wrapper
// For now, we'll process data collected via MCP queries

// Tables referenced in codebase (from grep searches)
const codebaseReferences = {
  'chat_sessions': ['api/chat.js', 'api/jobs/db-maintenance.js'],
  'chat_interactions': ['api/chat.js', 'api/jobs/db-maintenance.js'],
  'chat_events': ['api/chat.js'],
  'page_entities': ['api/chat.js', 'api/csv-import.js', 'api/tools.js'],
  'page_chunks': ['api/chat.js', 'api/csv-import.js', 'api/tools.js', 'api/db-health.js'],
  'page_html': ['api/jobs/db-maintenance.js'],
  'csv_metadata': ['api/csv-import.js', 'api/light-refresh.js'],
  'event_product_links_auto': ['api/admin.js'],
  'job_run_details': ['api/admin.js'],
  'job_progress': ['api/admin.js'],
  'light_refresh_runs': ['api/light-refresh.js'],
  'url_last_processed': ['api/light-refresh.js'],
  'v_events_for_chat': ['api/chat.js', 'api/tools.js'],
  'v_products_unified': ['api/chat.js'],
};

// Critical tables that must never be deleted
const CRITICAL_TABLES = [
  'page_entities', 'page_chunks', 'csv_metadata', 'chat_sessions',
  'chat_interactions', 'event', 'product', 'series', 'page_html'
];

// This function will be called with data from MCP queries
async function processAuditData(tablesData) {
  const auditDir = path.join(__dirname, '..', 'db-audit');
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }

  try {
    console.log('📊 Processing table metadata...');
    
    // Filter to only public schema and deduplicate
    const uniqueTables = new Map();
    tablesData.forEach(table => {
      if (!uniqueTables.has(table.tablename) || 
          (parseInt(table.row_count) || 0) > (parseInt(uniqueTables.get(table.tablename).row_count) || 0)) {
        uniqueTables.set(table.tablename, table);
      }
    });
    const tables = Array.from(uniqueTables.values());

    console.log(`✓ Processing ${tables.length} unique tables`);

    // Classify each table
    const classified = tables.map(table => {
      const classification = classifyTable(table);
      return { ...table, ...classification };
    });

    // Generate reports
    console.log('📝 Generating reports...');
    generateJSONReport(classified, auditDir);
    generateMarkdownReport(classified, auditDir);
    generateTerminalSummary(classified);

    console.log('\n✅ Audit complete!');
    console.log(`   Reports saved to: ${auditDir}/`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

function classifyTable(table) {
  const name = table.tablename;
  const rowCount = parseInt(table.row_count) || 0;
  const totalBytes = parseInt(table.total_bytes) || 0;
  const seqScans = parseInt(table.sequential_scans) || 0;
  const idxScans = parseInt(table.index_scans) || 0;
  const totalScans = seqScans + idxScans;
  const isReferenced = codebaseReferences[name] !== undefined;
  const isCritical = CRITICAL_TABLES.includes(name);
  const isBackup = name.includes('backup') || name.includes('_backup_');
  const isTmp = name.startsWith('tmp_');
  const isLegacy = name.includes('_old') || name.includes('legacy');
  const isSnapshot = name.includes('snapshot_');
  const isMaterializedView = name.startsWith('mv_');
  const isView = name.startsWith('v_');

  let classification = 'UNKNOWN';
  let risk = 'LOW';
  let notes = [];

  if (isCritical) {
    classification = 'CRITICAL';
    risk = 'HIGH';
    notes.push('Core chatbot table - DO NOT DELETE');
  } else if (isReferenced && rowCount > 0) {
    classification = 'ACTIVE';
    risk = 'MEDIUM';
    notes.push('Referenced in application code');
  } else if (isBackup || isSnapshot) {
    classification = 'LEGACY';
    risk = 'LOW';
    notes.push('Backup/snapshot table - candidate for deletion');
  } else if (isTmp) {
    classification = 'CACHE';
    risk = 'LOW';
    notes.push('Temporary/cache table - can be rebuilt');
  } else if (rowCount === 0) {
    classification = 'EMPTY';
    risk = 'LOW';
    notes.push('No rows - safe to delete if unused');
  } else if (totalScans < 10 && !isReferenced) {
    classification = 'ORPHAN';
    risk = 'LOW';
    notes.push('Very low usage - likely unused');
  } else if (isLegacy) {
    classification = 'LEGACY';
    risk = 'LOW';
    notes.push('Legacy table - candidate for deletion');
  } else if (isMaterializedView || isView) {
    classification = 'VIEW';
    risk = 'MEDIUM';
    notes.push('View or materialized view');
  } else if (totalBytes > 100 * 1024 * 1024) { // > 100MB
    classification = 'OVERSIZED';
    risk = 'MEDIUM';
    notes.push('Large table - review for optimization');
  } else {
    classification = 'ACTIVE';
    risk = 'MEDIUM';
  }

  return {
    classification,
    risk,
    notes: notes.join('; '),
    referenced_in_code: isReferenced,
    code_references: codebaseReferences[name] || []
  };
}

function generateJSONReport(tables, auditDir) {
  const report = {
    audit_date: new Date().toISOString(),
    total_tables: tables.length,
    summary: {
      by_classification: {},
      by_risk: {},
      total_size_bytes: 0,
      largest_tables: []
    },
    tables: tables.map(t => ({
      name: t.tablename,
      size: {
        total_bytes: parseInt(t.total_bytes) || 0,
        total_pretty: t.total_size_pretty,
        table_bytes: parseInt(t.table_bytes) || 0,
        index_bytes: parseInt(t.index_bytes) || 0
      },
      rows: {
        live: parseInt(t.row_count) || 0,
        dead: parseInt(t.dead_rows) || 0
      },
      indexes: {
        count: parseInt(t.index_count) || 0
      },
      usage: {
        sequential_scans: parseInt(t.sequential_scans) || 0,
        index_scans: parseInt(t.index_scans) || 0,
        total_scans: (parseInt(t.sequential_scans) || 0) + (parseInt(t.index_scans) || 0)
      },
      maintenance: {
        last_vacuum: t.last_vacuum,
        last_autovacuum: t.last_autovacuum,
        last_analyze: t.last_analyze,
        last_autoanalyze: t.last_autoanalyze
      },
      classification: t.classification,
      risk: t.risk,
      notes: t.notes,
      referenced_in_code: t.referenced_in_code,
      code_references: t.code_references
    }))
  };

  // Calculate summary statistics
  tables.forEach(t => {
    const bytes = parseInt(t.total_bytes) || 0;
    report.summary.total_size_bytes += bytes;
    
    report.summary.by_classification[t.classification] = 
      (report.summary.by_classification[t.classification] || 0) + 1;
    report.summary.by_risk[t.risk] = 
      (report.summary.by_risk[t.risk] || 0) + 1;
  });

  // Get largest tables
  report.summary.largest_tables = tables
    .sort((a, b) => (parseInt(b.total_bytes) || 0) - (parseInt(a.total_bytes) || 0))
    .slice(0, 10)
    .map(t => ({
      name: t.tablename,
      size: t.total_size_pretty,
      bytes: parseInt(t.total_bytes) || 0,
      rows: parseInt(t.row_count) || 0
    }));

  fs.writeFileSync(
    path.join(auditDir, 'db-audit.json'),
    JSON.stringify(report, null, 2)
  );
}

function generateMarkdownReport(tables, auditDir) {
  const totalSize = tables.reduce((sum, t) => sum + (parseInt(t.total_bytes) || 0), 0);
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  
  const byClassification = {};
  tables.forEach(t => {
    byClassification[t.classification] = (byClassification[t.classification] || 0) + 1;
  });

  const largestTables = tables
    .sort((a, b) => (parseInt(b.total_bytes) || 0) - (parseInt(a.total_bytes) || 0))
    .slice(0, 10);

  const redundantTables = tables
    .filter(t => ['LEGACY', 'ORPHAN', 'EMPTY', 'CACHE'].includes(t.classification))
    .sort((a, b) => (parseInt(b.total_bytes) || 0) - (parseInt(a.total_bytes) || 0));

  const criticalTables = tables.filter(t => t.classification === 'CRITICAL');

  let md = `# Database Audit Report\n\n`;
  md += `**Audit Date:** ${new Date().toISOString()}\n\n`;
  md += `**Total Tables Scanned:** ${tables.length}\n\n`;
  md += `**Total Database Size:** ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB (${totalSizeMB} MB)\n\n`;

  md += `## Summary by Classification\n\n`;
  Object.entries(byClassification)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cls, count]) => {
      md += `- **${cls}**: ${count} tables\n`;
    });

  md += `\n## Largest Tables\n\n`;
  md += `| Table Name | Size | Rows | Classification |\n`;
  md += `|------------|------|------|----------------|\n`;
  largestTables.forEach(t => {
    md += `| ${t.tablename} | ${t.total_size_pretty} | ${t.row_count || 0} | ${t.classification} |\n`;
  });

  md += `\n## Redundant Tables Recommended for Deletion\n\n`;
  md += `**Total Potential Space Recovery:** ${(redundantTables.reduce((sum, t) => sum + (parseInt(t.total_bytes) || 0), 0) / (1024 * 1024)).toFixed(2)} MB\n\n`;
  md += `| Table Name | Size | Rows | Classification | Notes |\n`;
  md += `|------------|------|------|----------------|-------|\n`;
  redundantTables.forEach(t => {
    md += `| ${t.tablename} | ${t.total_size_pretty} | ${t.row_count || 0} | ${t.classification} | ${t.notes} |\n`;
  });

  md += `\n## Critical Tables (DO NOT TOUCH)\n\n`;
  md += `| Table Name | Size | Rows | Risk |\n`;
  md += `|------------|------|------|------|\n`;
  criticalTables.forEach(t => {
    md += `| ${t.tablename} | ${t.total_size_pretty} | ${t.row_count || 0} | ${t.risk} |\n`;
  });

  md += `\n## Full Table-by-Table Breakdown\n\n`;
  tables.forEach(t => {
    md += `### ${t.tablename}\n\n`;
    md += `- **Size:** ${t.total_size_pretty} (${(parseInt(t.total_bytes) / (1024 * 1024)).toFixed(2)} MB)\n`;
    md += `- **Rows:** ${t.row_count || 0} (${t.dead_rows || 0} dead)\n`;
    md += `- **Indexes:** ${t.index_count || 0}\n`;
    md += `- **Scans:** ${(parseInt(t.sequential_scans) || 0) + (parseInt(t.index_scans) || 0)} total\n`;
    md += `- **Classification:** ${t.classification}\n`;
    md += `- **Risk:** ${t.risk}\n`;
    if (t.notes) md += `- **Notes:** ${t.notes}\n`;
    if (t.referenced_in_code) {
      md += `- **Code References:** ${t.code_references.join(', ')}\n`;
    }
    md += `\n`;
  });

  fs.writeFileSync(
    path.join(auditDir, 'db-audit.md'),
    md
  );
}

function generateTerminalSummary(tables) {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE AUDIT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tables: ${tables.length}`);
  
  const totalSize = tables.reduce((sum, t) => sum + (parseInt(t.total_bytes) || 0), 0);
  console.log(`Total Size: ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
  
  const byClassification = {};
  tables.forEach(t => {
    byClassification[t.classification] = (byClassification[t.classification] || 0) + 1;
  });
  
  console.log('\nBy Classification:');
  Object.entries(byClassification)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cls, count]) => {
      console.log(`  ${cls.padEnd(15)}: ${count}`);
    });
  
  console.log('\nTop 10 Largest Tables:');
  tables
    .sort((a, b) => (parseInt(b.total_bytes) || 0) - (parseInt(a.total_bytes) || 0))
    .slice(0, 10)
    .forEach((t, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${t.tablename.padEnd(40)} ${t.total_size_pretty.padStart(10)} (${t.row_count || 0} rows)`);
    });
}

// This script will be called with data from MCP queries
// For now, export the processing function
export { processAuditData, classifyTable, generateJSONReport, generateMarkdownReport, generateTerminalSummary };

