#!/usr/bin/env node

// Comprehensive CSV Field Mapping Analysis
// Maps ALL unique fields from ALL CSV files to ensure 100% coverage

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
    csv_columns: ['url'],
    database_fields: {
      'url': 'url'
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

console.log("📋 COMPREHENSIVE CSV FIELD MAPPING ANALYSIS");
console.log("=" * 80);

console.log("\n🔍 ALL UNIQUE CSV COLUMNS:");
const allCSVColumns = getAllUniqueCSVColumns();
allCSVColumns.forEach((column, index) => {
  console.log(`   ${index + 1}. ${column}`);
});

console.log("\n🗄️ ALL UNIQUE DATABASE FIELDS:");
const allDatabaseFields = getAllUniqueDatabaseFields();
allDatabaseFields.forEach((field, index) => {
  console.log(`   ${index + 1}. ${field}`);
});

console.log("\n📊 FIELD MAPPING BY CSV TYPE:");
Object.entries(CSV_FIELD_MAPPING).forEach(([csvType, mapping]) => {
  console.log(`\n   ${csvType.toUpperCase()}:`);
  console.log(`   CSV Columns: ${mapping.csv_columns.length}`);
  console.log(`   Database Fields: ${Object.keys(mapping.database_fields).length}`);
  
  Object.entries(mapping.database_fields).forEach(([csvCol, dbField]) => {
    console.log(`     ${csvCol} → ${dbField}`);
  });
});

console.log("\n🎯 SUMMARY:");
console.log(`   Total Unique CSV Columns: ${allCSVColumns.length}`);
console.log(`   Total Unique Database Fields: ${allDatabaseFields.length}`);
console.log(`   CSV Types: ${Object.keys(CSV_FIELD_MAPPING).length}`);

// Export for use in other scripts
export { CSV_FIELD_MAPPING, getAllUniqueDatabaseFields, getAllUniqueCSVColumns };
