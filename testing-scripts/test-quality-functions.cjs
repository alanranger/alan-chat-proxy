// Test the quality analysis functions directly
const fs = require('fs');

// Mock the quality analysis functions to test them
function analyzeDirectAnswer(responseText, queryLower) {
  const responseLower = responseText.toLowerCase();
  const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
  
  console.log(`🔍 analyzeDirectAnswer: query="${queryLower}", response="${responseText.substring(0, 50)}..."`);
  console.log(`🔍 Query words: ${queryWords.join(', ')}`);
  
  // Check for completely irrelevant responses
  const isIrrelevant = (
    responseLower.includes('based on alan ranger\'s expertise') &&
    !responseLower.includes(queryWords[0]) &&
    responseLower.includes('autumn photography')
  );
  if (isIrrelevant) return false;
  
  // Check for generic responses
  const isGeneric = (
    responseLower.startsWith('based on alan ranger\'s expertise') &&
    responseLower.includes('here\'s what you need to know') &&
    !responseLower.includes(queryWords[0])
  );
  if (isGeneric) return false;
  
  // Check for direct answer - updated with more flexible patterns
  const hasDirectAnswer = (
    responseText.length > 50 &&
    !responseLower.startsWith('here are some') &&
    !responseLower.startsWith('i found some') &&
    !responseLower.startsWith('here are the') &&
    queryWords.some(word => responseLower.includes(word)) &&
    (
      // Direct answers
      responseLower.includes('yes') || responseLower.includes('no') || 
      responseLower.includes('i can') || responseLower.includes('we offer') ||
      responseLower.includes('we have') || responseLower.includes('we provide') ||
      // Technical content
      responseLower.includes('aperture') || responseLower.includes('shutter') ||
      responseLower.includes('iso') || responseLower.includes('exposure') ||
      // Equipment/advice content
      responseLower.includes('camera') || responseLower.includes('lens') ||
      responseLower.includes('recommend') || responseLower.includes('suggest') ||
      responseLower.includes('equipment') || responseLower.includes('beginner') ||
      // Educational content
      responseLower.includes('guide') || responseLower.includes('tutorial') ||
      responseLower.includes('photography') || responseLower.includes('technique')
    )
  );
  
  console.log(`🔍 Has direct answer: ${hasDirectAnswer}`);
  return hasDirectAnswer;
}

function analyzeArticleRelevance(articles, queryLower) {
  if (!articles || articles.length === 0) return false;
  
  const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
  
  // Check for completely irrelevant articles
  const irrelevantPatterns = [
    'autumn photography', 'creative autumn', 'seasonal photography'
  ];
  const hasIrrelevantArticles = articles.some(article => {
    const articleTitle = (article.title || '').toLowerCase();
    return irrelevantPatterns.some(pattern => articleTitle.includes(pattern));
  });
  if (hasIrrelevantArticles && !queryLower.includes('autumn')) {
    return false;
  }
  
  const relevantArticles = articles.filter(article => {
    const articleTitle = (article.title || '').toLowerCase();
    const articleContent = (article.content || '').toLowerCase();
    return queryWords.some(word => 
      articleTitle.includes(word) || articleContent.includes(word)
    );
  });
  const relevanceRatio = relevantArticles.length / articles.length;
  return relevanceRatio >= 0.5;
}

function analyzeActionableInfo(responseText) {
  const responseLower = responseText.toLowerCase();
  return (
    responseLower.includes('you can') || 
    responseLower.includes('you should') || 
    responseLower.includes('try') || 
    responseLower.includes('use') || 
    responseLower.includes('start') || 
    responseLower.includes('begin') ||
    responseLower.includes('recommend') ||
    responseLower.includes('suggest')
  );
}

function calculateCompleteness(responseText, queryLower) {
  const responseLower = responseText.toLowerCase();
  const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
  
  let completenessScore = 0;
  
  // Check if response addresses key query words
  const addressedWords = queryWords.filter(word => responseLower.includes(word));
  completenessScore += (addressedWords.length / queryWords.length) * 0.4;
  
  // Check response length
  if (responseText.length > 100) completenessScore += 0.2;
  if (responseText.length > 200) completenessScore += 0.2;
  if (responseText.length > 500) completenessScore += 0.2;
  
  // Check for specific content types
  if (responseLower.includes('yes') || responseLower.includes('no')) completenessScore += 0.1;
  if (responseLower.includes('offer') || responseLower.includes('provide')) completenessScore += 0.1;
  
  return Math.min(1.0, completenessScore);
}

function calculateAccuracy(responseText, queryLower) {
  const responseLower = responseText.toLowerCase();
  let accuracyScore = 0.5;
  const queryWords = (queryLower || '').split(/\s+/).filter(word => word.length > 2);
  
  // Check for completely irrelevant responses
  if (responseLower.includes('based on alan ranger\'s expertise') && 
      responseLower.includes('autumn photography') && 
      !queryLower.includes('autumn')) {
    return 0.0;
  }
  if (responseLower.startsWith('based on alan ranger\'s expertise') &&
      responseLower.includes('here\'s what you need to know') &&
      !queryWords.some(word => responseLower.includes(word))) {
    return 0.1;
  }
  
  if (responseLower.includes('yes') || responseLower.includes('no')) accuracyScore += 0.2;
  if (responseLower.includes('we offer') || responseLower.includes('we provide')) accuracyScore += 0.2;
  if (responseLower.includes('i can help') || responseLower.includes('i can assist')) accuracyScore += 0.1;
  if (queryWords.some(word => responseLower.includes(word))) accuracyScore += 0.2;
  
  if (responseLower.includes('i don\'t know') || responseLower.includes('i can\'t help')) accuracyScore -= 0.3;
  if (responseLower.includes('sorry') && responseLower.includes('can\'t')) accuracyScore -= 0.2;
  
  return Math.max(0.0, Math.min(1.0, accuracyScore));
}

// Test with sample responses
console.log('=== TESTING QUALITY ANALYSIS FUNCTIONS ===\n');

// Test 1: Aperture query
const apertureResponse = "# 02 What is APERTURE in photography: A Guide for Beginners\n\n**Source**: [https://www.alanranger.com/blog-on-photography/what-is-aperture-in-photography](https://www.alanranger.com/blog-on-photography/what-is-aperture-in-photography)\n\n02 WHAT IS APERTURE IN PHOTOGRAPHY: A GUIDE FOR BEGINNERS";
console.log('1. APERTURE QUERY:');
console.log('Query: "what is aperture"');
console.log('Response:', apertureResponse.substring(0, 100) + '...');
console.log('Direct Answer:', analyzeDirectAnswer(apertureResponse, 'what is aperture'));
console.log('Relevant Articles:', analyzeArticleRelevance([], 'what is aperture'));
console.log('Actionable Info:', analyzeActionableInfo(apertureResponse));
console.log('Completeness:', calculateCompleteness(apertureResponse, 'what is aperture'));
console.log('Accuracy:', calculateAccuracy(apertureResponse, 'what is aperture'));
console.log('---\n');

// Test 2: Commercial photography query
const commercialResponse = "Based on Alan Ranger's expertise, here's what you need to know about your question.\n\nFIVE CREATIVE AUTUMN PHOTOGRAPHY IDEAS FOR BEGINNERS";
console.log('2. COMMERCIAL PHOTOGRAPHY QUERY:');
console.log('Query: "do you do commercial photography"');
console.log('Response:', commercialResponse.substring(0, 100) + '...');
console.log('Direct Answer:', analyzeDirectAnswer(commercialResponse, 'do you do commercial photography'));
console.log('Relevant Articles:', analyzeArticleRelevance([], 'do you do commercial photography'));
console.log('Actionable Info:', analyzeActionableInfo(commercialResponse));
console.log('Completeness:', calculateCompleteness(commercialResponse, 'do you do commercial photography'));
console.log('Accuracy:', calculateAccuracy(commercialResponse, 'do you do commercial photography'));
console.log('---\n');

// Test 3: Camera recommendation query
const cameraResponse = "**Equipment Recommendations:**\n\nChoosing the right camera depends on several factors: experience level, budget, and intended use. Here's a comprehensive guide to help you make the best decision.";
console.log('3. CAMERA RECOMMENDATION QUERY:');
console.log('Query: "what camera do you recommend for a beginner"');
console.log('Response:', cameraResponse.substring(0, 100) + '...');
console.log('Direct Answer:', analyzeDirectAnswer(cameraResponse, 'what camera do you recommend for a beginner'));
console.log('Relevant Articles:', analyzeArticleRelevance([], 'what camera do you recommend for a beginner'));
console.log('Actionable Info:', analyzeActionableInfo(cameraResponse));
console.log('Completeness:', calculateCompleteness(cameraResponse, 'what camera do you recommend for a beginner'));
console.log('Accuracy:', calculateAccuracy(cameraResponse, 'what camera do you recommend for a beginner'));
console.log('---\n');
