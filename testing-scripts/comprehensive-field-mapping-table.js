#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Complete field mapping from ALL CSV files
const CSV_FIELD_MAPPING = {
  // Blog CSV (01)
  blog: {
    csv_columns: ['Title', 'Url Id', 'Full Url', 'Categories', 'Tags', 'Image', 'Publish On'],
    database_fields: {
      'Title': 'title',
      'Url Id': 'url_id', 
      'Full Url': 'url',
      'Categories': 'categories',
      'Tags': 'tags',
      'Image': 'image_url',
      'Publish On': 'publish_date'
    }
  },
  
  // Course Events CSV (02)
  course_events: {
    csv_columns: ['Event_Title', 'Start_Date', 'Start_Time', 'End_Date', 'End_Time', 'Category', 'Tags', 'Excerpt', 'Location_Business_Name', 'Location_Address', 'Location_City_State_ZIP', 'Event_URL', 'Event_Image', 'Text_Block', 'Published_Date', 'Workflow_State'],
    database_fields: {
      'Event_Title': 'title',
      'Start_Date': 'start_date',
      'Start_Time': 'start_time', 
      'End_Date': 'end_date',
      'End_Time': 'end_time',
      'Category': 'categories',
      'Tags': 'tags',
      'Excerpt': 'excerpt',
      'Location_Business_Name': 'location_name',
      'Location_Address': 'location_address',
      'Location_City_State_ZIP': 'location_city_state_zip',
      'Event_URL': 'url',
      'Event_Image': 'image_url',
      'Text_Block': 'description',
      'Published_Date': 'publish_date',
      'Workflow_State': 'workflow_state'
    }
  },
  
  // Workshop Events CSV (03) - Same structure as course_events
  workshop_events: {
    csv_columns: ['Event_Title', 'Start_Date', 'Start_Time', 'End_Date', 'End_Time', 'Category', 'Tags', 'Excerpt', 'Location_Business_Name', 'Location_Address', 'Location_City_State_ZIP', 'Event_URL', 'Event_Image', 'Text_Block', 'Published_Date', 'Workflow_State'],
    database_fields: {
      'Event_Title': 'title',
      'Start_Date': 'start_date',
      'Start_Time': 'start_time',
      'End_Date': 'end_date', 
      'End_Time': 'end_time',
      'Category': 'categories',
      'Tags': 'tags',
      'Excerpt': 'excerpt',
      'Location_Business_Name': 'location_name',
      'Location_Address': 'location_address',
      'Location_City_State_ZIP': 'location_city_state_zip',
      'Event_URL': 'url',
      'Event_Image': 'image_url',
      'Text_Block': 'description',
      'Published_Date': 'publish_date',
      'Workflow_State': 'workflow_state'
    }
  },
  
  // Course Products CSV (04) - Same as blog
  course_products: {
    csv_columns: ['Title', 'Url Id', 'Full Url', 'Categories', 'Tags', 'Image', 'Publish On'],
    database_fields: {
      'Title': 'title',
      'Url Id': 'url_id',
      'Full Url': 'url', 
      'Categories': 'categories',
      'Tags': 'tags',
      'Image': 'image_url',
      'Publish On': 'publish_date'
    }
  },
  
  // Workshop Products CSV (05) - Same as blog
  workshop_products: {
    csv_columns: ['Title', 'Url Id', 'Full Url', 'Categories', 'Tags', 'Image', 'Publish On'],
    database_fields: {
      'Title': 'title',
      'Url Id': 'url_id',
      'Full Url': 'url',
      'Categories': 'categories', 
      'Tags': 'tags',
      'Image': 'image_url',
      'Publish On': 'publish_date'
    }
  },
  
  // Site URLs CSV (06)
  site_urls: {
    csv_columns: ['url', 'title'],
    database_fields: {
      'url': 'url',
      'title': 'title'
    }
  },
  
  // Product Schema CSV (07)
  product_schema: {
    csv_columns: ['Title', 'JSON-LD Structured Data'],
    database_fields: {
      'Title': 'title',
      'JSON-LD Structured Data': 'json_ld_data'
    }
  }
};

// Get all unique database fields across all CSV types
function getAllUniqueDatabaseFields() {
  const allFields = new Set();
  
  Object.values(CSV_FIELD_MAPPING).forEach(mapping => {
    Object.values(mapping.database_fields).forEach(field => {
      allFields.add(field);
    });
  });
  
  return Array.from(allFields).sort();
}

// Get all unique CSV columns across all CSV types  
function getAllUniqueCSVColumns() {
  const allColumns = new Set();
  
  Object.values(CSV_FIELD_MAPPING).forEach(mapping => {
    mapping.csv_columns.forEach(column => {
      allColumns.add(column);
    });
  });
  
  return Array.from(allColumns).sort();
}

async function getDatabaseSchema() {
  console.log('🔍 Fetching database schema...');
  
  // Get csv_metadata columns
  const { data: csvMetadataColumns } = await supa
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'csv_metadata')
    .order('column_name');
  
  // Get page_entities columns
  const { data: pageEntitiesColumns } = await supa
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'page_entities')
    .order('column_name');
  
  return {
    csv_metadata: csvMetadataColumns || [],
    page_entities: pageEntitiesColumns || []
  };
}

async function main() {
  console.log('📋 COMPREHENSIVE CSV FIELD MAPPING TABLE');
  console.log('=' * 100);
  
  const schema = await getDatabaseSchema();
  const allCSVColumns = getAllUniqueCSVColumns();
  const allDatabaseFields = getAllUniqueDatabaseFields();
  
  console.log('\n📊 FIELD MAPPING TABLE:');
  console.log('CSV Column → Database Field → csv_metadata → page_entities');
  console.log('-'.repeat(100));
  
  // Create mapping table
  const mappingTable = [];
  
  allCSVColumns.forEach(csvColumn => {
    // Find which CSV types use this column
    const csvTypes = Object.entries(CSV_FIELD_MAPPING)
      .filter(([type, mapping]) => mapping.csv_columns.includes(csvColumn))
      .map(([type]) => type);
    
    // Find the database field it maps to
    const databaseField = Object.values(CSV_FIELD_MAPPING)
      .find(mapping => mapping.csv_columns.includes(csvColumn))
      ?.database_fields[csvColumn];
    
    // Check if field exists in csv_metadata
    const csvMetadataExists = schema.csv_metadata.some(col => col.column_name === databaseField);
    const csvMetadataType = schema.csv_metadata.find(col => col.column_name === databaseField)?.data_type || 'N/A';
    
    // Check if field exists in page_entities
    const pageEntitiesExists = schema.page_entities.some(col => col.column_name === databaseField);
    const pageEntitiesType = schema.page_entities.find(col => col.column_name === databaseField)?.data_type || 'N/A';
    
    mappingTable.push({
      csvColumn,
      csvTypes: csvTypes.join(', '),
      databaseField,
      csvMetadataExists,
      csvMetadataType,
      pageEntitiesExists,
      pageEntitiesType
    });
  });
  
  // Display the table
  mappingTable.forEach(row => {
    const csvCol = row.csvColumn.padEnd(25);
    const dbField = (row.databaseField || 'N/A').padEnd(20);
    const csvMeta = row.csvMetadataExists ? `✅ ${row.csvMetadataType}`.padEnd(15) : '❌ MISSING'.padEnd(15);
    const pageEnt = row.pageEntitiesExists ? `✅ ${row.pageEntitiesType}`.padEnd(15) : '❌ MISSING'.padEnd(15);
    const csvTypes = row.csvTypes.padEnd(20);
    
    console.log(`${csvCol} → ${dbField} → ${csvMeta} → ${pageEnt} | ${csvTypes}`);
  });
  
  console.log('\n📈 SUMMARY:');
  console.log(`Total Unique CSV Columns: ${allCSVColumns.length}`);
  console.log(`Total Unique Database Fields: ${allDatabaseFields.length}`);
  console.log(`Fields in csv_metadata: ${schema.csv_metadata.length}`);
  console.log(`Fields in page_entities: ${schema.page_entities.length}`);
  
  // Count missing fields
  const missingInCsvMetadata = mappingTable.filter(row => !row.csvMetadataExists).length;
  const missingInPageEntities = mappingTable.filter(row => !row.pageEntitiesExists).length;
  
  console.log(`Missing in csv_metadata: ${missingInCsvMetadata}`);
  console.log(`Missing in page_entities: ${missingInPageEntities}`);
  
  console.log('\n🔍 MISSING FIELDS:');
  if (missingInCsvMetadata > 0) {
    console.log('\n❌ Missing in csv_metadata:');
    mappingTable.filter(row => !row.csvMetadataExists).forEach(row => {
      console.log(`   ${row.csvColumn} → ${row.databaseField}`);
    });
  }
  
  if (missingInPageEntities > 0) {
    console.log('\n❌ Missing in page_entities:');
    mappingTable.filter(row => !row.pageEntitiesExists).forEach(row => {
      console.log(`   ${row.csvColumn} → ${row.databaseField}`);
    });
  }
}

main().catch(console.error);
