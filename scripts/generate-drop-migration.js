import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the audit JSON
const auditPath = path.join(__dirname, '..', 'db-audit', 'db-audit.json');
const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

// Extract redundant tables (EMPTY, CACHE, LEGACY)
const redundantTables = auditData.tables
  .filter(table => ['EMPTY', 'CACHE', 'LEGACY'].includes(table.classification))
  .sort((a, b) => (parseInt(b.size.total_bytes) || 0) - (parseInt(a.size.total_bytes) || 0));

console.log(`Found ${redundantTables.length} redundant tables to drop:`);
redundantTables.forEach(t => {
  console.log(`  - ${t.name} (${t.classification}, ${t.size.total_pretty})`);
});

// Generate SQL migration
let sql = `-- Drop redundant tables identified by database audit
-- Generated: ${new Date().toISOString()}
-- Total tables to drop: ${redundantTables.length}
-- Classification breakdown:
--   LEGACY: ${redundantTables.filter(t => t.classification === 'LEGACY').length}
--   CACHE: ${redundantTables.filter(t => t.classification === 'CACHE').length}
--   EMPTY: ${redundantTables.filter(t => t.classification === 'EMPTY').length}

BEGIN;

-- ============================================================================
-- STEP 1: Kill all locks on redundant tables
-- ============================================================================

`;

// Kill locks for all tables
const tableNames = redundantTables.map(t => t.name);
sql += `-- Kill all backend processes touching any of the redundant tables
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND (
`;
sql += tableNames.map(name => `    query ILIKE '%${name}%'`).join(' OR\n');
sql += `
  );

-- ============================================================================
-- STEP 2: Truncate tables (if they exist)
-- ============================================================================

`;

// Truncate each table if it exists
redundantTables.forEach(table => {
  sql += `-- Truncate ${table.name} (${table.classification}, ${table.size.total_pretty})
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '${table.name}') THEN
        TRUNCATE TABLE ${table.name} CASCADE;
        RAISE NOTICE 'Truncated table: ${table.name}';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: ${table.name}';
    END IF;
END $$;

`;
});

sql += `-- ============================================================================
-- STEP 3: Drop tables with CASCADE (if they exist)
-- ============================================================================

`;

// Drop each table
redundantTables.forEach(table => {
  sql += `-- Drop ${table.name} (${table.classification}, ${table.size.total_pretty})
DROP TABLE IF EXISTS ${table.name} CASCADE;

`;
});

sql += `-- ============================================================================
-- STEP 4: Verify table removal
-- ============================================================================

-- Verify all redundant tables have been removed
SELECT 
    tablename,
    to_regclass('public.' || tablename) AS still_exists
FROM (
    VALUES
`;
sql += tableNames.map(name => `    ('${name}')`).join(',\n');
sql += `
) AS t(tablename)
WHERE to_regclass('public.' || tablename) IS NOT NULL
ORDER BY tablename;

COMMIT;
`;

// Write migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251119_drop_redundant_tables.sql');
fs.writeFileSync(migrationPath, sql, 'utf8');

console.log(`\n✅ Migration file created: ${migrationPath}`);
console.log(`   Total tables to drop: ${redundantTables.length}`);
console.log(`   Total size to recover: ${(redundantTables.reduce((sum, t) => sum + (parseInt(t.size.total_bytes) || 0), 0) / (1024 * 1024)).toFixed(2)} MB`);

