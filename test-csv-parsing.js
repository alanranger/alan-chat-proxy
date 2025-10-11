#!/usr/bin/env node

// Test CSV parsing to see what's actually being read

import fs from 'fs';
import csv from 'csv-parser';

const csvFile = 'CSVSs from website/01-Alan Ranger Blog On Photography - Tips, Offers and News-CSV.csv';

console.log('🔍 Testing CSV Parsing...\n');

const rows = [];

fs.createReadStream(csvFile)
  .pipe(csv())
  .on('data', (row) => {
    rows.push(row);
    if (rows.length <= 3) {
      console.log(`Row ${rows.length}:`);
      console.log('  Title:', row.Title);
      console.log('  Categories:', row.Categories);
      console.log('  Tags:', row.Tags);
      console.log('  Full Url:', row['Full Url']);
      console.log('  All keys:', Object.keys(row));
      console.log('');
    }
  })
  .on('end', () => {
    console.log(`Total rows parsed: ${rows.length}`);
    
    // Check if categories and tags are being read
    const rowsWithCategories = rows.filter(row => row.Categories && row.Categories.trim());
    const rowsWithTags = rows.filter(row => row.Tags && row.Tags.trim());
    
    console.log(`Rows with categories: ${rowsWithCategories.length}`);
    console.log(`Rows with tags: ${rowsWithTags.length}`);
    
    if (rowsWithCategories.length > 0) {
      console.log('Sample categories:', rowsWithCategories[0].Categories);
    }
    if (rowsWithTags.length > 0) {
      console.log('Sample tags:', rowsWithTags[0].Tags);
    }
  });
