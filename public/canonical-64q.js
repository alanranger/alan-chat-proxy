/**
 * Canonical 64Q Test Question List
 * Single source of truth for all regression testing tools
 * 
 * This file is loaded by:
 * - regression-comparison.html
 * - interactive-testing.html
 * - cron-dashboard.html (if needed)
 * 
 * Version: 1.0
 * Created: 2025-11-27
 */

// Load canonical questions from JSON file
let CANONICAL_64Q_QUESTIONS = null;
let CANONICAL_64Q_LOADED = false;

async function loadCanonical64Q() {
  if (CANONICAL_64Q_LOADED) {
    return CANONICAL_64Q_QUESTIONS;
  }
  
  try {
    const response = await fetch('/canonical-64q-questions.json');
    if (!response.ok) {
      throw new Error(`Failed to load canonical 64Q: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    if (data.questions.length !== 64) {
      console.warn(`⚠️ WARNING: Canonical file has ${data.questions.length} questions, expected 64`);
    }
    
    CANONICAL_64Q_QUESTIONS = data.questions;
    CANONICAL_64Q_LOADED = true;
    
    return CANONICAL_64Q_QUESTIONS;
  } catch (error) {
    console.error('Error loading canonical 64Q:', error);
    throw error;
  }
}

// Helper function to get questions array (for backward compatibility)
async function getCanonicalQuestions() {
  const questions = await loadCanonical64Q();
  return questions.map(q => q.question);
}

// Helper function to get questions with metadata
async function getCanonicalQuestionsWithMetadata() {
  return await loadCanonical64Q();
}

// Helper function to get categories array
async function getCanonicalCategories() {
  const questions = await loadCanonical64Q();
  return questions.map(q => q.category);
}

// Export for use in HTML files
if (typeof window !== 'undefined') {
  window.Canonical64Q = {
    load: loadCanonical64Q,
    getQuestions: getCanonicalQuestions,
    getQuestionsWithMetadata: getCanonicalQuestionsWithMetadata,
    getCategories: getCanonicalCategories
  };
}

