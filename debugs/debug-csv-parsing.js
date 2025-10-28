#!/usr/bin/env node

import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

// Test CSV parsing with the actual blog CSV file
const csvFilePath = path.resolve(process.cwd(), 'CSVSs from website/01-Alan Ranger Blog On Photography - Tips, Offers and News-CSV.csv');

console.log('🔍 DEBUGGING CSV PARSING...');
console.log('');

fs.readFile(csvFilePath, { encoding: 'utf8' }, (err, data) => {
  if (err) {
    console.error('Error reading CSV file:', err);
    return;
  }

  console.log('📄 First 500 characters of CSV file:');
  console.log(data.substring(0, 500));
  console.log('');

  const records = [];
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
      records.push(row);
    })
    .on('end', () => {

    console.log('🔍 PARSED RECORDS:');
    console.log('');

    // Show first 3 records with all their fields
    records.slice(0, 3).forEach((row, index) => {
      console.log(`📋 Row ${index + 1}:`);
      console.log(`   Title: "${row.Title}"`);
      console.log(`   Categories: "${row.Categories}"`);
      console.log(`   Tags: "${row.Tags}"`);
      console.log(`   Full Url: "${row['Full Url']}"`);
      console.log(`   Image: "${row.Image}"`);
      console.log(`   Publish On: "${row['Publish On']}"`);
      console.log('');
      
      // Show all keys to see if there are any unexpected ones
      console.log(`   All keys: ${JSON.stringify(Object.keys(row), null, 2)}`);
      console.log('');
    });

    // Test the parsing logic from csv-import.js
    console.log('🧪 TESTING PARSING LOGIC:');
    console.log('');

    const testRow = records[0];
    console.log('Test Row:', testRow);
    console.log('');

    // Test categories parsing
    const categoriesRaw = testRow.Categories;
    console.log(`Categories Raw: "${categoriesRaw}"`);
    console.log(`Categories Type: ${typeof categoriesRaw}`);
    console.log(`Categories Length: ${categoriesRaw ? categoriesRaw.length : 'null'}`);
    
    if (categoriesRaw && categoriesRaw.trim()) {
      const categoriesSplit = categoriesRaw.split(';').map(c => c.trim()).filter(Boolean);
      console.log(`Categories Split: ${JSON.stringify(categoriesSplit)}`);
    } else {
      console.log('Categories: Empty or null');
    }
    console.log('');

    // Test tags parsing
    const tagsRaw = testRow.Tags;
    console.log(`Tags Raw: "${tagsRaw}"`);
    console.log(`Tags Type: ${typeof tagsRaw}`);
    console.log(`Tags Length: ${tagsRaw ? tagsRaw.length : 'null'}`);
    
    if (tagsRaw && tagsRaw.trim()) {
      const tagsSplit = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      console.log(`Tags Split: ${JSON.stringify(tagsSplit)}`);
    } else {
      console.log('Tags: Empty or null');
    }
    console.log('');

    // Test BOM handling
    console.log('🔤 BOM TESTING:');
    console.log(`Title with BOM: "${testRow['﻿Title']}"`);
    console.log(`Title without BOM: "${testRow.Title}"`);
    console.log(`Title fallback: "${testRow.title}"`);
    console.log('');

    console.log(`Total records parsed: ${records.length}`);
    });
});
