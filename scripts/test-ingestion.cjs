#!/usr/bin/env node
/**
 * Test Ingestion Pipeline Script
 * 
 * Validates all CSV and JSON schema files in the shared-resources repository.
 * This is a read-only test script that does not modify any files.
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Path to shared-resources (relative to Chat AI Bot directory)
const SHARED_RESOURCES_PATH = path.join(__dirname, '..', '..', 'alan-shared-resources');
const CSV_PATH = path.join(SHARED_RESOURCES_PATH, 'csv');
const SCHEMA_PATH = path.join(SHARED_RESOURCES_PATH, 'outputs', 'schema');

// Test results storage
const results = {
  csv: { passed: [], failed: [], missing: [] },
  json: { passed: [], failed: [], missing: [] },
};

/**
 * Recursively find all files matching a pattern
 */
function findFiles(dir, extension, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, extension, fileList);
    } else if (file.endsWith(extension)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Validate CSV file - check headers are non-empty
 */
function validateCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return { valid: false, error: 'No data lines found' };
    }
    
    // Get header line (first non-empty line)
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    if (headers.length === 0) {
      return { valid: false, error: 'No headers found' };
    }
    
    // Check for empty headers
    const emptyHeaders = headers.filter(h => !h || h.length === 0);
    if (emptyHeaders.length > 0) {
      return { valid: false, error: `Found ${emptyHeaders.length} empty header(s)` };
    }
    
    return { 
      valid: true, 
      headers: headers.length,
      rows: lines.length - 1 
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Validate JSON file
 */
function validateJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'File is empty' };
    }
    
    const parsed = JSON.parse(content);
    
    // Basic validation - check it's an object or array
    if (typeof parsed !== 'object' || parsed === null) {
      return { valid: false, error: 'JSON is not an object or array' };
    }
    
    return { 
      valid: true, 
      type: Array.isArray(parsed) ? 'array' : 'object',
      keys: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Get relative path for display
 */
function getRelativePath(filePath) {
  return path.relative(SHARED_RESOURCES_PATH, filePath);
}

/**
 * Print section header
 */
function printSection(title) {
  console.log('\n' + colors.bright + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + title + colors.reset);
  console.log(colors.bright + colors.cyan + '='.repeat(80) + colors.reset);
}

/**
 * Print test results
 */
function printResults() {
  // CSV Results
  printSection('CSV FILE VALIDATION RESULTS');
  
  if (results.csv.passed.length > 0) {
    console.log('\n' + colors.green + '✓ PASSED (' + results.csv.passed.length + ')' + colors.reset);
    results.csv.passed.forEach(item => {
      console.log(`  ${colors.green}✓${colors.reset} ${getRelativePath(item.path)}`);
      console.log(`    Headers: ${item.headers}, Rows: ${item.rows}`);
    });
  }
  
  if (results.csv.failed.length > 0) {
    console.log('\n' + colors.red + '✗ FAILED (' + results.csv.failed.length + ')' + colors.reset);
    results.csv.failed.forEach(item => {
      console.log(`  ${colors.red}✗${colors.reset} ${getRelativePath(item.path)}`);
      console.log(`    Error: ${colors.yellow}${item.error}${colors.reset}`);
    });
  }
  
  if (results.csv.missing.length > 0) {
    console.log('\n' + colors.yellow + '⚠ MISSING (' + results.csv.missing.length + ')' + colors.reset);
    results.csv.missing.forEach(item => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${item}`);
    });
  }
  
  // JSON Results
  printSection('JSON SCHEMA FILE VALIDATION RESULTS');
  
  if (results.json.passed.length > 0) {
    console.log('\n' + colors.green + '✓ PASSED (' + results.json.passed.length + ')' + colors.reset);
    results.json.passed.forEach(item => {
      console.log(`  ${colors.green}✓${colors.reset} ${getRelativePath(item.path)}`);
      console.log(`    Type: ${item.type}, Keys/Items: ${item.keys}`);
    });
  }
  
  if (results.json.failed.length > 0) {
    console.log('\n' + colors.red + '✗ FAILED (' + results.json.failed.length + ')' + colors.reset);
    results.json.failed.forEach(item => {
      console.log(`  ${colors.red}✗${colors.reset} ${getRelativePath(item.path)}`);
      console.log(`    Error: ${colors.yellow}${item.error}${colors.reset}`);
    });
  }
  
  if (results.json.missing.length > 0) {
    console.log('\n' + colors.yellow + '⚠ MISSING (' + results.json.missing.length + ')' + colors.reset);
    results.json.missing.forEach(item => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${item}`);
    });
  }
  
  // Summary
  printSection('SUMMARY');
  const totalCSV = results.csv.passed.length + results.csv.failed.length;
  const totalJSON = results.json.passed.length + results.json.failed.length;
  const totalPassed = results.csv.passed.length + results.json.passed.length;
  const totalFailed = results.csv.failed.length + results.json.failed.length;
  const totalMissing = results.csv.missing.length + results.json.missing.length;
  
  console.log(`\nCSV Files: ${colors.green}${results.csv.passed.length} passed${colors.reset}, ${colors.red}${results.csv.failed.length} failed${colors.reset}, ${colors.yellow}${totalCSV} total${colors.reset}`);
  console.log(`JSON Files: ${colors.green}${results.json.passed.length} passed${colors.reset}, ${colors.red}${results.json.failed.length} failed${colors.reset}, ${colors.yellow}${totalJSON} total${colors.reset}`);
  console.log(`Missing Files: ${colors.yellow}${totalMissing}${colors.reset}`);
  console.log(`\nOverall: ${colors.green}${totalPassed} passed${colors.reset}, ${colors.red}${totalFailed} failed${colors.reset}, ${colors.yellow}${totalMissing} missing${colors.reset}`);
  
  if (totalFailed === 0 && totalMissing === 0) {
    console.log(`\n${colors.bright}${colors.green}✓ All files validated successfully!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.bright}${colors.red}✗ Some files failed validation or are missing${colors.reset}\n`);
    process.exit(1);
  }
}

/**
 * Main test function
 */
function runTests() {
  console.log(colors.bright + colors.blue + '\n🧪 Ingestion Pipeline Test Script' + colors.reset);
  console.log(colors.cyan + 'Testing files in: ' + SHARED_RESOURCES_PATH + colors.reset);
  
  // Test CSV files
  console.log('\n' + colors.blue + 'Scanning CSV files...' + colors.reset);
  const csvFiles = findFiles(CSV_PATH, '.csv');
  
  if (csvFiles.length === 0) {
    console.log(colors.yellow + '  ⚠ No CSV files found in ' + CSV_PATH + colors.reset);
  } else {
    console.log(`  Found ${csvFiles.length} CSV file(s)`);
    csvFiles.forEach(filePath => {
      const validation = validateCSV(filePath);
      if (validation.valid) {
        results.csv.passed.push({
          path: filePath,
          headers: validation.headers,
          rows: validation.rows
        });
      } else {
        results.csv.failed.push({
          path: filePath,
          error: validation.error
        });
      }
    });
  }
  
  // Test JSON schema files
  console.log('\n' + colors.blue + 'Scanning JSON schema files...' + colors.reset);
  const jsonFiles = findFiles(SCHEMA_PATH, '.json');
  
  if (jsonFiles.length === 0) {
    console.log(colors.yellow + '  ⚠ No JSON files found in ' + SCHEMA_PATH + colors.reset);
  } else {
    console.log(`  Found ${jsonFiles.length} JSON file(s)`);
    jsonFiles.forEach(filePath => {
      const validation = validateJSON(filePath);
      if (validation.valid) {
        results.json.passed.push({
          path: filePath,
          type: validation.type,
          keys: validation.keys
        });
      } else {
        results.json.failed.push({
          path: filePath,
          error: validation.error
        });
      }
    });
  }
  
  // Print results
  printResults();
}

// Run the tests
try {
  runTests();
} catch (error) {
  console.error(colors.red + '\n✗ Fatal error: ' + error.message + colors.reset);
  console.error(error.stack);
  process.exit(1);
}

