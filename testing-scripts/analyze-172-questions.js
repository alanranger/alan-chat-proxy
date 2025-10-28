// Comprehensive Analysis: Test 172 Questions Against Existing Supabase Data
// This script analyzes how many of the 172 test questions can be answered with current data

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Read the 172 test questions
const questions = fs.readFileSync('CSVSs from website/new test question batch.csv', 'utf8')
  .split('\n')
  .slice(1) // Skip header
  .map(line => line.trim())
  .filter(line => line.length > 0);

console.log(`📊 Analyzing ${questions.length} questions against existing Supabase data...\n`);

// Test functions for different question types
async function testEquipmentQuestions() {
  console.log('🔧 Testing Equipment Questions...');
  const equipmentKeywords = ['tripod', 'camera', 'lens', 'bag', 'memory card', 'filter', 'flash'];
  const results = [];
  
  for (const keyword of equipmentKeywords) {
    const { data, error } = await supabase
      .from('page_entities')
      .select('title, description, categories, tags')
      .eq('kind', 'article')
      .or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%,categories.cs.{${keyword}},tags.cs.{${keyword}}`);
    
    if (!error && data && data.length > 0) {
      results.push({ keyword, count: data.length, articles: data.map(d => d.title) });
    }
  }
  
  return results;
}

async function testTechnicalQuestions() {
  console.log('📚 Testing Technical Questions...');
  const technicalKeywords = ['exposure', 'aperture', 'iso', 'shutter', 'composition', 'white balance', 'manual mode'];
  const results = [];
  
  for (const keyword of technicalKeywords) {
    const { data, error } = await supabase
      .from('page_entities')
      .select('title, description, categories, tags')
      .eq('kind', 'article')
      .or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%,categories.cs.{${keyword}},tags.cs.{${keyword}}`);
    
    if (!error && data && data.length > 0) {
      results.push({ keyword, count: data.length, articles: data.map(d => d.title) });
    }
  }
  
  return results;
}

async function testWorkshopQuestions() {
  console.log('🎯 Testing Workshop Questions...');
  const { data, error } = await supabase
    .from('v_events_for_chat')
    .select('event_title, event_url, date_start, date_end, event_location')
    .gte('date_start', new Date().toISOString());
  
  if (error) {
    console.error('Error fetching events:', error);
    return { count: 0, events: [] };
  }
  
  return { count: data.length, events: data };
}

async function testCourseQuestions() {
  console.log('📖 Testing Course Questions...');
  const { data, error } = await supabase
    .from('page_entities')
    .select('title, description, categories, tags')
    .eq('kind', 'service')
    .or('title.ilike.%course%,title.ilike.%free%,description.ilike.%course%,description.ilike.%free%');
  
  if (error) {
    console.error('Error fetching courses:', error);
    return { count: 0, courses: [] };
  }
  
  return { count: data.length, courses: data };
}

async function testPricingQuestions() {
  console.log('💰 Testing Pricing Questions...');
  const { data, error } = await supabase
    .from('page_entities')
    .select('title, description, price, price_currency')
    .not('price', 'is', null);
  
  if (error) {
    console.error('Error fetching pricing:', error);
    return { count: 0, items: [] };
  }
  
  return { count: data.length, items: data };
}

async function testLocationQuestions() {
  console.log('📍 Testing Location Questions...');
  const { data, error } = await supabase
    .from('v_events_for_chat')
    .select('event_location, event_title')
    .gte('date_start', new Date().toISOString());
  
  if (error) {
    console.error('Error fetching locations:', error);
    return { count: 0, locations: [] };
  }
  
  const uniqueLocations = [...new Set(data.map(d => d.event_location))];
  return { count: uniqueLocations.length, locations: uniqueLocations };
}

async function testEditingQuestions() {
  console.log('🎨 Testing Editing Questions...');
  const editingKeywords = ['lightroom', 'photoshop', 'editing', 'raw', 'preset', 'color grading'];
  const results = [];
  
  for (const keyword of editingKeywords) {
    const { data, error } = await supabase
      .from('page_entities')
      .select('title, description, categories, tags')
      .eq('kind', 'article')
      .or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%,categories.cs.{${keyword}},tags.cs.{${keyword}}`);
    
    if (!error && data && data.length > 0) {
      results.push({ keyword, count: data.length, articles: data.map(d => d.title) });
    }
  }
  
  return results;
}

async function testBeginnerQuestions() {
  console.log('🌱 Testing Beginner Questions...');
  const { data, error } = await supabase
    .from('page_entities')
    .select('title, description, categories, tags')
    .eq('kind', 'article')
    .or('title.ilike.%beginner%,description.ilike.%beginner%,categories.cs.{beginner}');
  
  if (error) {
    console.error('Error fetching beginner content:', error);
    return { count: 0, articles: [] };
  }
  
  return { count: data.length, articles: data };
}

// Main analysis function
async function analyzeAllQuestions() {
  console.log('🚀 Starting comprehensive analysis...\n');
  
  const results = {
    equipment: await testEquipmentQuestions(),
    technical: await testTechnicalQuestions(),
    workshops: await testWorkshopQuestions(),
    courses: await testCourseQuestions(),
    pricing: await testPricingQuestions(),
    locations: await testLocationQuestions(),
    editing: await testEditingQuestions(),
    beginner: await testBeginnerQuestions()
  };
  
  // Calculate coverage estimates
  const coverage = {
    equipment: results.equipment.length > 0 ? 'HIGH' : 'LOW',
    technical: results.technical.length > 0 ? 'HIGH' : 'LOW',
    workshops: results.workshops.count > 0 ? 'HIGH' : 'LOW',
    courses: results.courses.count > 0 ? 'MEDIUM' : 'LOW',
    pricing: results.pricing.count > 0 ? 'MEDIUM' : 'LOW',
    locations: results.locations.count > 0 ? 'HIGH' : 'LOW',
    editing: results.editing.length > 0 ? 'HIGH' : 'LOW',
    beginner: results.beginner.count > 0 ? 'HIGH' : 'LOW'
  };
  
  // Generate report
  console.log('\n📋 COMPREHENSIVE ANALYSIS REPORT');
  console.log('=====================================\n');
  
  console.log('📊 DATA AVAILABILITY SUMMARY:');
  console.log(`• Equipment Articles: ${results.equipment.length} topics covered`);
  console.log(`• Technical Articles: ${results.technical.length} topics covered`);
  console.log(`• Workshop Events: ${results.workshops.count} events available`);
  console.log(`• Course Services: ${results.courses.count} courses available`);
  console.log(`• Pricing Data: ${results.pricing.count} items with pricing`);
  console.log(`• Event Locations: ${results.locations.count} unique locations`);
  console.log(`• Editing Articles: ${results.editing.length} topics covered`);
  console.log(`• Beginner Content: ${results.beginner.count} articles available`);
  
  console.log('\n🎯 COVERAGE ASSESSMENT:');
  Object.entries(coverage).forEach(([category, level]) => {
    const emoji = level === 'HIGH' ? '✅' : level === 'MEDIUM' ? '⚠️' : '❌';
    console.log(`${emoji} ${category.toUpperCase()}: ${level}`);
  });
  
  // Estimate answerable questions
  const highCoverage = Object.values(coverage).filter(v => v === 'HIGH').length;
  const mediumCoverage = Object.values(coverage).filter(v => v === 'MEDIUM').length;
  const lowCoverage = Object.values(coverage).filter(v => v === 'LOW').length;
  
  const estimatedAnswerable = Math.round(
    (highCoverage * 0.8 + mediumCoverage * 0.5 + lowCoverage * 0.2) / 
    (highCoverage + mediumCoverage + lowCoverage) * 172
  );
  
  console.log('\n📈 ESTIMATED COVERAGE:');
  console.log(`• High Coverage Categories: ${highCoverage}/8`);
  console.log(`• Medium Coverage Categories: ${mediumCoverage}/8`);
  console.log(`• Low Coverage Categories: ${lowCoverage}/8`);
  console.log(`• Estimated Answerable Questions: ${estimatedAnswerable}/172 (${Math.round(estimatedAnswerable/172*100)}%)`);
  
  // Detailed breakdown
  console.log('\n🔍 DETAILED BREAKDOWN:');
  
  if (results.equipment.length > 0) {
    console.log('\n🔧 Equipment Articles Found:');
    results.equipment.forEach(r => {
      console.log(`  • ${r.keyword}: ${r.count} articles`);
    });
  }
  
  if (results.technical.length > 0) {
    console.log('\n📚 Technical Articles Found:');
    results.technical.forEach(r => {
      console.log(`  • ${r.keyword}: ${r.count} articles`);
    });
  }
  
  if (results.workshops.count > 0) {
    console.log('\n🎯 Workshop Events Found:');
    console.log(`  • Total Events: ${results.workshops.count}`);
    console.log(`  • Sample Events: ${results.workshops.events.slice(0, 3).map(e => e.event_title).join(', ')}`);
  }
  
  if (results.courses.count > 0) {
    console.log('\n📖 Course Services Found:');
    console.log(`  • Total Courses: ${results.courses.count}`);
    console.log(`  • Sample Courses: ${results.courses.courses.slice(0, 3).map(c => c.title).join(', ')}`);
  }
  
  if (results.editing.length > 0) {
    console.log('\n🎨 Editing Articles Found:');
    results.editing.forEach(r => {
      console.log(`  • ${r.keyword}: ${r.count} articles`);
    });
  }
  
  // Save detailed results
  const report = {
    timestamp: new Date().toISOString(),
    totalQuestions: 172,
    estimatedAnswerable,
    coveragePercentage: Math.round(estimatedAnswerable/172*100),
    coverage,
    results,
    summary: {
      equipment: results.equipment.length,
      technical: results.technical.length,
      workshops: results.workshops.count,
      courses: results.courses.count,
      pricing: results.pricing.count,
      locations: results.locations.count,
      editing: results.editing.length,
      beginner: results.beginner.count
    }
  };
  
  fs.writeFileSync('results/172-questions-analysis.json', JSON.stringify(report, null, 2));
  console.log('\n💾 Detailed report saved to: results/172-questions-analysis.json');
  
  return report;
}

// Run the analysis
analyzeAllQuestions().catch(console.error);
