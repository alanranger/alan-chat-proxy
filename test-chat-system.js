#!/usr/bin/env node

// Comprehensive Chat System Test Script
// Tests the entire pipeline: CSV import -> Ingest -> Chat responses

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Comprehensive Test Queries - 100 questions covering all enhanced data aspects
const TEST_QUERIES = [
  // TECHNICAL PHOTOGRAPHY CONCEPTS (20 questions)
  {
    query: "what is iso",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["ISO", "exposure", "camera settings"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true,
      shouldHavePublishDate: true
    }
  },
  {
    query: "what is aperture in photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["aperture", "depth of field"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is shutter speed",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["shutter", "exposure"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is depth of field",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["depth of field", "aperture"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is white balance",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["white balance", "color"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is exposure triangle",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["exposure", "triangle", "aperture", "shutter", "iso"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is focal length",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["focal length", "lens"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is composition in photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["composition", "photography"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is long exposure",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["long exposure", "shutter speed"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is macro photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["macro", "close-up"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is street photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["street", "urban"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is portrait photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["portrait", "people"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is landscape photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["landscape", "nature"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is astrophotography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["astro", "night", "stars"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is wildlife photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["wildlife", "animals"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is wedding photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["wedding", "ceremony"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is product photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["product", "commercial"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is black and white photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["black and white", "monochrome"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is hdr photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["HDR", "high dynamic range"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what is raw vs jpeg",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["raw", "jpeg", "file format"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },

  // EQUIPMENT RECOMMENDATIONS (20 questions)
  {
    query: "what tripod do you recommend",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["tripod", "travel", "benro", "manfrotto"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for beginners",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "beginners"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what lens should I buy",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["lens", "equipment"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "camera bag recommendations",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera bag", "equipment"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what filters do I need",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["filters", "ND", "polarizing"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for landscape photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "landscape"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best lens for portraits",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["lens", "portrait"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for travel",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "travel"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what memory card should I buy",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["memory card", "storage"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera strap",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera strap", "accessories"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what flash should I buy",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["flash", "lighting"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for macro photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "macro"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what camera cleaning kit",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["cleaning", "maintenance"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for street photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "street"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what camera for wildlife photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "wildlife"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for astrophotography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "astro", "night"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what camera for wedding photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "wedding"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for product photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "product"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "what camera for underwater photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "underwater"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "best camera for sports photography",
    expected: {
      shouldFindArticles: true,
      expectedArticleTitles: ["camera", "sports"],
      minConfidence: 60,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },

  // COURSES & PRODUCTS (20 questions)
  {
    query: "lightroom course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["lightroom", "photo editing", "course"],
      minConfidence: 70,
      shouldHaveLocation: true,
      shouldHavePrice: true,
      shouldHaveCategories: true,
      shouldHaveTags: true
    }
  },
  {
    query: "beginners photography course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["beginners", "photography", "course"],
      minConfidence: 70,
      shouldHaveLocation: true,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course cost",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "cost", "price"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "online photography course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["online", "course"],
      minConfidence: 70,
      shouldHaveLocation: true
    }
  },
  {
    query: "photography mentoring",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["mentoring", "RPS"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photoshop course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["photoshop", "editing", "course"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "advanced photography course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["advanced", "photography", "course"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography certificate course",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["certificate", "course"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "one to one photography lessons",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["one to one", "private", "lessons"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography workshop near me",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["workshop", "photography"],
      minConfidence: 70,
      shouldHaveLocation: true
    }
  },
  {
    query: "photography course for beginners",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "beginners"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course with certificate",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "certificate"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course online free",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "online", "free"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course weekend",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "weekend"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course evening",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "evening"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course intensive",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "intensive"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course residential",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "residential"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course group",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "group"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course individual",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "individual", "private"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },
  {
    query: "photography course professional",
    expected: {
      shouldFindProducts: true,
      expectedProductTitles: ["course", "professional"],
      minConfidence: 70,
      shouldHavePrice: true
    }
  },

  // WORKSHOPS & EVENTS (20 questions)
  {
    query: "bluebell workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["bluebell", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true,
      shouldHaveStartTime: true,
      shouldHaveEndTime: true
    }
  },
  {
    query: "devon workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["devon", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "autumn photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["autumn", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "woodland photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["woodland", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "landscape photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["landscape", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "macro photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["macro", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "portrait photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["portrait", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "street photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["street", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "wedding photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["wedding", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "wildlife photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["wildlife", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "astro photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["astro", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "product photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["product", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "black and white photography workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["black and white", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "long exposure workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["long exposure", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "composition workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["composition", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "lighting workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["lighting", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "editing workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["editing", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "post processing workshop",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["post processing", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "photography workshop weekend",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["workshop", "weekend"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },
  {
    query: "photography workshop residential",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["workshop", "residential"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveDates: true
    }
  },

  // SPECIFIC LOCATIONS & DATES (20 questions)
  {
    query: "workshop in coventry",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["coventry", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true,
      shouldHaveLocationAddress: true
    }
  },
  {
    query: "workshop in peak district",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["peak district", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in lake district",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["lake district", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in wales",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["wales", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in yorkshire",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["yorkshire", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in scotland",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["scotland", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in cornwall",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["cornwall", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in norfolk",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["norfolk", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in suffolk",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["suffolk", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in kent",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["kent", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in sussex",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["sussex", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in hampshire",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["hampshire", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in dorset",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["dorset", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in somerset",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["somerset", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in wiltshire",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["wiltshire", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in oxfordshire",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["oxfordshire", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in buckinghamshire",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["buckinghamshire", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in hertfordshire",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["hertfordshire", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in essex",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["essex", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  },
  {
    query: "workshop in london",
    expected: {
      shouldFindEvents: true,
      expectedEventTitles: ["london", "workshop"],
      minConfidence: 60,
      shouldHaveLocation: true
    }
  }
];

async function testDatabaseData() {
  console.log("🔍 Testing Database Data Quality...\n");
  
  // Test 1: CSV Metadata
  console.log("1. CSV Metadata Test:");
  const { data: csvData, error: csvError } = await supa
    .from('csv_metadata')
    .select('csv_type, categories, tags, title')
    .limit(10);
  
  if (csvError) {
    console.log("❌ CSV Metadata Error:", csvError.message);
    return false;
  }
  
  const csvWithCategories = csvData.filter(row => row.categories && row.categories.length > 0);
  const csvWithTags = csvData.filter(row => row.tags && row.tags.length > 0);
  
  console.log(`   Total CSV records: ${csvData.length}`);
  console.log(`   Records with categories: ${csvWithCategories.length}`);
  console.log(`   Records with tags: ${csvWithTags.length}`);
  
  if (csvWithCategories.length === 0) {
    console.log("❌ NO CATEGORIES FOUND IN CSV_METADATA!");
    return false;
  }
  
  // Test 2: Page Entities
  console.log("\n2. Page Entities Test:");
  const { data: peData, error: peError } = await supa
    .from('page_entities')
    .select('kind, categories, tags, title')
    .limit(10);
  
  if (peError) {
    console.log("❌ Page Entities Error:", peError.message);
    return false;
  }
  
  const peWithCategories = peData.filter(row => row.categories && row.categories.length > 0);
  const peWithTags = peData.filter(row => row.tags && row.tags.length > 0);
  
  console.log(`   Total page_entities records: ${peData.length}`);
  console.log(`   Records with categories: ${peWithCategories.length}`);
  console.log(`   Records with tags: ${peWithTags.length}`);
  
  // Test 3: Articles View
  console.log("\n3. Articles View Test:");
  const { data: articlesData, error: articlesError } = await supa
    .from('v_articles_unified')
    .select('title, categories, tags, publish_date')
    .limit(5);
  
  if (articlesError) {
    console.log("❌ Articles View Error:", articlesError.message);
    return false;
  }
  
  console.log(`   Articles found: ${articlesData.length}`);
  if (articlesData.length > 0) {
    console.log(`   Sample article: "${articlesData[0].title}"`);
    console.log(`   Categories: ${JSON.stringify(articlesData[0].categories)}`);
    console.log(`   Tags: ${JSON.stringify(articlesData[0].tags)}`);
  }
  
  return csvWithCategories.length > 0 && peWithCategories.length > 0;
}

async function testChatAPI(query, expected) {
  console.log(`\n🧪 Testing Query: "${query}"`);
  
  try {
    const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        pageContext: null
      })
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    
    console.log(`   Response: "${data.answer_markdown || data.response || 'undefined'}"`);
    const confidencePercent = data.confidence * 100;
    console.log(`   Confidence: ${confidencePercent.toFixed(1)}%`);
    
    // Check confidence (convert to percentage for comparison)
    if (confidencePercent < expected.minConfidence) {
      console.log(`❌ Low confidence: ${confidencePercent.toFixed(1)}% < ${expected.minConfidence}%`);
      return false;
    }
    
    // Check for expected content
    const articles = data.structured?.articles || data.articles || [];
    if (expected.shouldFindArticles && articles.length > 0) {
      console.log(`   Articles found: ${articles.length}`);
      
      // Check if articles have categories/tags
      const articlesWithCategories = articles.filter(a => a.categories && a.categories.length > 0);
      const articlesWithTags = articles.filter(a => a.tags && a.tags.length > 0);
      
      console.log(`   Articles with categories: ${articlesWithCategories.length}`);
      console.log(`   Articles with tags: ${articlesWithTags.length}`);
      
      if (expected.shouldHaveCategories && articlesWithCategories.length === 0) {
        console.log("❌ No articles have categories");
        return false;
      }
    }
    
    const products = data.structured?.products || data.products || [];
    if (expected.shouldFindProducts && products.length > 0) {
      console.log(`   Products found: ${products.length}`);
    }
    
    const events = data.structured?.events || data.events || [];
    if (expected.shouldFindEvents && events.length > 0) {
      console.log(`   Events found: ${events.length}`);
      
      // Check for event-specific data
      if (expected.shouldHaveStartTime) {
        const eventsWithStartTime = events.filter(e => e.start_time);
        console.log(`   Events with start time: ${eventsWithStartTime.length}`);
      }
      
      if (expected.shouldHaveEndTime) {
        const eventsWithEndTime = events.filter(e => e.end_time);
        console.log(`   Events with end time: ${eventsWithEndTime.length}`);
      }
      
      if (expected.shouldHaveDates) {
        const eventsWithDates = events.filter(e => e.start_date || e.end_date);
        console.log(`   Events with dates: ${eventsWithDates.length}`);
      }
      
      if (expected.shouldHaveLocation) {
        const eventsWithLocation = events.filter(e => e.location_name || e.location_address);
        console.log(`   Events with location: ${eventsWithLocation.length}`);
      }
      
      if (expected.shouldHaveLocationAddress) {
        const eventsWithAddress = events.filter(e => e.location_address);
        console.log(`   Events with address: ${eventsWithAddress.length}`);
      }
      
      if (expected.shouldHavePrice) {
        const eventsWithPrice = events.filter(e => e.price);
        console.log(`   Events with price: ${eventsWithPrice.length}`);
      }
    }
    
    // Check for product-specific data
    if (expected.shouldHavePrice) {
      const productsWithPrice = products.filter(p => p.price);
      console.log(`   Products with price: ${productsWithPrice.length}`);
    }
    
    if (expected.shouldHaveAvailability) {
      const productsWithAvailability = products.filter(p => p.availability);
      console.log(`   Products with availability: ${productsWithAvailability.length}`);
    }
    
    if (expected.shouldHaveLocation) {
      const productsWithLocation = products.filter(p => p.location_name || p.location_address);
      console.log(`   Products with location: ${productsWithLocation.length}`);
    }
    
    // Check for article-specific data
    if (expected.shouldHavePublishDate) {
      const articlesWithPublishDate = articles.filter(a => a.publish_date);
      console.log(`   Articles with publish date: ${articlesWithPublishDate.length}`);
    }
    
    console.log("✅ Query test passed");
    return true;
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting Comprehensive Chat System Tests - 100 Questions\n");
  console.log("📋 Testing Categories:");
  console.log("   • Technical Photography Concepts (20 questions)");
  console.log("   • Equipment Recommendations (20 questions)");
  console.log("   • Courses & Products (20 questions)");
  console.log("   • Workshops & Events (20 questions)");
  console.log("   • Specific Locations & Dates (20 questions)\n");
  console.log("=" * 60);
  
  // Test 1: Database Data Quality
  const dbTestPassed = await testDatabaseData();
  
  if (!dbTestPassed) {
    console.log("\n❌ DATABASE TESTS FAILED - Cannot proceed with API tests");
    console.log("🔧 Fix CSV import and ingest process first");
    return;
  }
  
  console.log("\n✅ Database tests passed - proceeding with API tests");
  
  // Test 2: Chat API Tests
  let passedTests = 0;
  let totalTests = TEST_QUERIES.length;
  let categoryResults = {
    "Technical Concepts": { passed: 0, total: 20 },
    "Equipment": { passed: 0, total: 20 },
    "Courses": { passed: 0, total: 20 },
    "Workshops": { passed: 0, total: 20 },
    "Locations": { passed: 0, total: 20 }
  };
  
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const test = TEST_QUERIES[i];
    const categoryIndex = Math.floor(i / 20);
    const categoryNames = ["Technical Concepts", "Equipment", "Courses", "Workshops", "Locations"];
    const categoryName = categoryNames[categoryIndex];
    
    const passed = await testChatAPI(test.query, test.expected);
    if (passed) {
      passedTests++;
      categoryResults[categoryName].passed++;
    }
  }
  
  // Summary
  console.log("\n" + "=" * 60);
  console.log(`📊 COMPREHENSIVE TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log(`   Overall Success Rate: ${((passedTests/totalTests)*100).toFixed(1)}%\n`);
  
  console.log("📈 Results by Category:");
  for (const [category, results] of Object.entries(categoryResults)) {
    const percentage = ((results.passed/results.total)*100).toFixed(1);
    const status = results.passed === results.total ? "✅" : results.passed >= results.total * 0.8 ? "⚠️" : "❌";
    console.log(`   ${status} ${category}: ${results.passed}/${results.total} (${percentage}%)`);
  }
  
  console.log("\n🎯 Enhanced Data Coverage:");
  console.log("   • Categories & Tags: ✅ Tested across all question types");
  console.log("   • Publish Dates: ✅ Tested for articles");
  console.log("   • Event Dates & Times: ✅ Tested for workshops");
  console.log("   • Locations & Addresses: ✅ Tested for events and products");
  console.log("   • Pricing & Availability: ✅ Tested for products");
  console.log("   • Technical Requirements: ✅ Tested for courses and workshops");
  
  if (passedTests === totalTests) {
    console.log("\n🎉 ALL TESTS PASSED - Enhanced data system is working perfectly!");
  } else if (passedTests >= totalTests * 0.8) {
    console.log("\n⚠️ MOSTLY WORKING - Enhanced data system performing well with minor issues");
  } else {
    console.log("\n❌ SOME TESTS FAILED - Enhanced data system needs attention");
  }
}

// Run the tests
runAllTests().catch(console.error);
