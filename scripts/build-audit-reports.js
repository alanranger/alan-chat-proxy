/**
 * Build Comprehensive Database Audit Reports
 * Processes collected SQL query data and generates JSON + Markdown reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const auditDir = path.join(__dirname, '..', 'db-audit');
if (!fs.existsSync(auditDir)) {
  fs.mkdirSync(auditDir, { recursive: true });
}

// Codebase references
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

const CRITICAL_TABLES = [
  'page_entities', 'page_chunks', 'csv_metadata', 'chat_sessions',
  'chat_interactions', 'event', 'product', 'series', 'page_html',
  'product_display_price', 'event_product_links_auto', 'chat_events'
];

// Process the data from the last SQL query
// The data will be passed in or read from a file
// For now, this is the structure

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
  } else if (totalBytes > 100 * 1024 * 1024) {
    classification = 'OVERSIZED';
    risk = 'MEDIUM';
    notes.push('Large table - review for optimization');
  } else {
    classification = 'ACTIVE';
    risk = 'MEDIUM';
  }

  return { classification, risk, notes: notes.join('; '), isReferenced, codeReferences: codebaseReferences[name] || [] };
}

console.log('Database audit report builder ready');
console.log('This script processes table data and generates comprehensive reports');

