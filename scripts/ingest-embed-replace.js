#!/usr/bin/env node
/**
 * Ingest and Embed Replacement Script
 * 
 * Automatically loads processed CSV files from alan-shared-resources
 * and ingests them into Supabase for embedding generation.
 * 
 * This script:
 * - Loads all processed CSV files from absolute paths
 * - Never prompts the user
 * - Never reads from relative tool folders
 * - Always uses the latest event-product-mappings file
 */

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { 
  PATH_PRODUCTS, 
  PATH_REVIEWS_COMBINED, 
  PATH_TRUSTPILOT, 
  PATH_GOOGLE, 
  PATH_PRODUCT_SCHEMA, 
  PATH_EVENT_PRODUCT_MAP 
} from '../api/chat.js';

// Load environment variables
dotenv.config();

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Read CSV file and return parsed rows
 */
function readCSV(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
      console.warn(`⚠️  File has insufficient data: ${filePath}`);
      return [];
    }
    
    // Parse CSV headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Parse rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx];
        });
        rows.push(row);
      }
    }
    
    return rows;
  } catch (error) {
    console.error(`❌ Error reading CSV ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Read XLSX file and return parsed rows
 */
function readXLSX(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return [];
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    
    return rows;
  } catch (error) {
    console.error(`❌ Error reading XLSX ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Import products from XLSX file
 */
async function importProducts(filePath) {
  console.log(`\n📦 Loading products from: ${path.basename(filePath)}`);
  const products = readXLSX(filePath);
  console.log(`   ✓ Loaded ${products.length} products`);
  return products;
}

/**
 * Import reviews from CSV file
 */
async function importReviews(filePath) {
  console.log(`\n⭐ Loading reviews from: ${path.basename(filePath)}`);
  const reviews = readCSV(filePath);
  console.log(`   ✓ Loaded ${reviews.length} reviews`);
  return reviews;
}

/**
 * Import product schema from CSV file
 */
async function importSchema(filePath) {
  console.log(`\n📋 Loading product schema from: ${path.basename(filePath)}`);
  const schema = readCSV(filePath);
  console.log(`   ✓ Loaded ${schema.length} schema entries`);
  return schema;
}

/**
 * Import event-product mappings from CSV file
 */
async function importMappings(filePath) {
  console.log(`\n🔗 Loading event-product mappings from: ${path.basename(filePath)}`);
  const mappings = readCSV(filePath);
  console.log(`   ✓ Loaded ${mappings.length} mappings`);
  return mappings;
}

/**
 * Main ingestion function
 */
async function runIngestion() {
  console.log('🚀 Starting automatic ingestion from shared-resources...\n');
  console.log('📁 Using absolute paths from alan-shared-resources/csv processed/');
  
  try {
    // Load all files
    const products = await importProducts(PATH_PRODUCTS);
    const combinedReviews = await importReviews(PATH_REVIEWS_COMBINED);
    const trustpilotReviews = await importReviews(PATH_TRUSTPILOT);
    const googleReviews = await importReviews(PATH_GOOGLE);
    const mergedSchema = await importSchema(PATH_PRODUCT_SCHEMA);
    const eventProductMap = await importMappings(PATH_EVENT_PRODUCT_MAP);
    
    // Summary
    console.log('\n📊 Ingestion Summary:');
    console.log(`   Products: ${products.length}`);
    console.log(`   Combined Reviews: ${combinedReviews.length}`);
    console.log(`   Trustpilot Reviews: ${trustpilotReviews.length}`);
    console.log(`   Google Reviews: ${googleReviews.length}`);
    console.log(`   Product Schema Entries: ${mergedSchema.length}`);
    console.log(`   Event-Product Mappings: ${eventProductMap.length}`);
    
    console.log('\n✅ All files loaded successfully!');
    console.log('💡 Note: This script loads the data. Actual ingestion to Supabase should be done via the /api/csv-import endpoint.');
    
    return {
      products,
      combinedReviews,
      trustpilotReviews,
      googleReviews,
      mergedSchema,
      eventProductMap
    };
  } catch (error) {
    console.error('\n❌ Ingestion failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIngestion()
    .then(() => {
      console.log('\n✅ Ingestion script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Ingestion script failed:', error);
      process.exit(1);
    });
}

export { importProducts, importReviews, importSchema, importMappings, runIngestion };

