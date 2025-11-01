#!/usr/bin/env node
/**
 * Comprehensive Response Quality & Related Information Analysis
 * 
 * This script performs exhaustive analysis of:
 * 1. Answer quality (beyond just character count)
 * 2. Related information relevance (do tiles actually match the query?)
 * 3. Hardcoded answer detection (which questions use hardcoded answers)
 * 4. Response routing accuracy
 * 5. Content matching quality
 * 
 * Creates baseline for comparison before making improvements
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_URL = 'localhost';
const API_PORT = 3000;
const API_PATH = '/api/chat';

// Load test data
const interactiveData = JSON.parse(fs.readFileSync('testing-scripts/interactive-testing-data.json', 'utf8'));

const testConfig = {
  name: '40-question-quality-analysis',
  questions: interactiveData.questions.flatMap(cat => cat.questions.map(q => ({
    question: q.question,
    category: q.category,
    focus: q.focus
  }))),
  description: 'Comprehensive quality analysis of 40 questions - answer quality and related information relevance'
};

// Keywords that indicate hardcoded answers
const HARDCODED_INDICATORS = {
  technical: ['exposure triangle', 'iso', 'aperture', 'shutter speed', 'raw', 'jpeg', 'white balance', 'hdr', 'depth of field', 'histogram', 'long exposure', 'flash photography', 'low light', 'composition', 'sharpness'],
  policy: ['terms', 'conditions', 'privacy', 'data protection', 'cancellation', 'booking', 'payment plan', 'instalment', 'refund'],
  service: ['gift voucher', 'contact', 'subscribe', 'free course', 'certificate', 'photography academy'],
  about: ['alan ranger', 'who is', 'background', 'ethical', 'guidelines', 'environmental'],
  equipment: ['camera', 'equipment', 'gear', 'laptop'],
  contact: ['contact', 'email', 'phone', 'whatsapp', 'how do i contact']
};

// Extract keywords from query for relevance matching
function extractQueryKeywords(query) {
  const qlc = query.toLowerCase();
  const words = qlc.split(/\s+/).filter(w => w.length > 2);
  const importantWords = words.filter(w => 
    !['what', 'is', 'are', 'how', 'do', 'does', 'can', 'will', 'the', 'a', 'an', 'for', 'with', 'you', 'your', 'this', 'that'].includes(w)
  );
  return [...new Set(importantWords)];
}

// Check if answer appears to be hardcoded
function detectHardcodedAnswer(query, answer, responseType) {
  const qlc = query.toLowerCase();
  const answerLower = answer.toLowerCase();
  
  const indicators = [];
  
  // Check technical answers
  if (HARDCODED_INDICATORS.technical.some(keyword => qlc.includes(keyword))) {
    indicators.push('technical');
  }
  
  // Check policy answers
  if (HARDCODED_INDICATORS.policy.some(keyword => qlc.includes(keyword))) {
    indicators.push('policy');
  }
  
  // Check service answers
  if (HARDCODED_INDICATORS.service.some(keyword => qlc.includes(keyword))) {
    indicators.push('service');
  }
  
  // Check about answers
  if (HARDCODED_INDICATORS.about.some(keyword => qlc.includes(keyword))) {
    indicators.push('about');
  }
  
  // Check equipment answers
  if (HARDCODED_INDICATORS.equipment.some(keyword => qlc.includes(keyword))) {
    indicators.push('equipment');
  }
  
  // Check contact answers
  if (HARDCODED_INDICATORS.contact.some(keyword => qlc.includes(keyword))) {
    indicators.push('contact');
  }
  
  // Additional signals
  if (answerLower.includes('alan ranger') && qlc.includes('who')) {
    indicators.push('about');
  }
  
  if (answerLower.includes('gift voucher') || answerLower.includes('gift vouchers')) {
    indicators.push('service');
  }
  
  return {
    isHardcoded: indicators.length > 0,
    hardcodedType: indicators[0] || null,
    allTypes: indicators
  };
}

// Analyze answer quality beyond just length
function analyzeAnswerQuality(query, answer, responseType) {
  if (!answer || answer.length === 0) {
    return {
      quality: 'empty',
      score: 0,
      issues: ['No answer provided'],
      strengths: []
    };
  }
  
  const qlc = query.toLowerCase();
  const answerLower = answer.toLowerCase();
  const queryKeywords = extractQueryKeywords(query);
  
  let score = 0;
  const issues = [];
  const strengths = [];
  
  // Length analysis
  if (answer.length < 50) {
    issues.push('Answer too short (<50 chars)');
    score -= 10;
  } else if (answer.length >= 200) {
    strengths.push('Comprehensive answer (≥200 chars)');
    score += 10;
  }
  
  // Keyword coverage - does answer mention query keywords?
  const matchedKeywords = queryKeywords.filter(keyword => answerLower.includes(keyword));
  const keywordCoverage = queryKeywords.length > 0 ? matchedKeywords.length / queryKeywords.length : 0;
  
  if (keywordCoverage >= 0.7) {
    strengths.push(`High keyword coverage (${(keywordCoverage * 100).toFixed(0)}%)`);
    score += 15;
  } else if (keywordCoverage < 0.3) {
    issues.push(`Low keyword coverage (${(keywordCoverage * 100).toFixed(0)}%)`);
    score -= 10;
  }
  
  // Response type appropriateness
  if (qlc.includes('course') || qlc.includes('workshop') || qlc.includes('event')) {
    if (responseType === 'events') {
      strengths.push('Correct routing to events');
      score += 10;
    } else if (responseType === 'advice' && !answerLower.includes('course') && !answerLower.includes('workshop')) {
      issues.push('Event query routed to advice but answer doesn\'t mention courses/workshops');
      score -= 5;
    }
  }
  
  // Specificity check
  if (answerLower.includes('contact') || answerLower.includes('please contact') || answerLower.includes('contact form')) {
    if (qlc.includes('contact') || qlc.includes('email') || qlc.includes('phone')) {
      strengths.push('Appropriate contact answer');
      score += 5;
    } else {
      issues.push('Generic contact fallback for non-contact query');
      score -= 15;
    }
  }
  
  // Generic fallback detection
  const genericPatterns = [
    /i can't find.*reliable answer/i,
    /please contact.*directly/i,
    /for detailed information.*contact/i
  ];
  
  const hasGenericFallback = genericPatterns.some(pattern => pattern.test(answer));
  if (hasGenericFallback && !qlc.includes('contact')) {
    issues.push('Generic fallback response');
    score -= 20;
  }
  
  // Formatting quality
  if (answer.includes('**') || answer.includes('##')) {
    strengths.push('Well-formatted (markdown)');
    score += 5;
  }
  
  // Overall quality rating
  let quality;
  if (score >= 20) quality = 'excellent';
  else if (score >= 10) quality = 'good';
  else if (score >= 0) quality = 'acceptable';
  else if (score >= -10) quality = 'poor';
  else quality = 'very_poor';
  
  return {
    quality,
    score,
    issues,
    strengths,
    keywordCoverage,
    matchedKeywords: matchedKeywords.length,
    totalKeywords: queryKeywords.length
  };
}

// Analyze related information relevance
function analyzeRelatedInformationRelevance(query, structured) {
  const qlc = query.toLowerCase();
  const queryKeywords = extractQueryKeywords(query);
  
  const analysis = {
    articles: { count: 0, relevant: 0, relevanceScore: 0, samples: [] },
    events: { count: 0, relevant: 0, relevanceScore: 0, samples: [] },
    services: { count: 0, relevant: 0, relevanceScore: 0, samples: [] },
    products: { count: 0, relevant: 0, relevanceScore: 0, samples: [] },
    overall: { hasRelatedInfo: false, totalItems: 0, relevantItems: 0, averageRelevance: 0 }
  };
  
  // Analyze articles
  if (structured?.articles && Array.isArray(structured.articles)) {
    analysis.articles.count = structured.articles.length;
    analysis.articles.samples = structured.articles.slice(0, 3).map(a => ({
      title: a.title || a.page_title || '',
      url: a.page_url || a.url || ''
    }));
    
    structured.articles.forEach(article => {
      const title = (article.title || article.page_title || '').toLowerCase();
      const url = (article.page_url || article.url || '').toLowerCase();
      
      // Check relevance
      const keywordMatches = queryKeywords.filter(kw => title.includes(kw) || url.includes(kw)).length;
      const relevance = queryKeywords.length > 0 ? keywordMatches / queryKeywords.length : 0;
      
      if (relevance >= 0.3) {
        analysis.articles.relevant++;
        analysis.articles.relevanceScore += relevance;
      }
    });
    
    if (analysis.articles.count > 0) {
      analysis.articles.relevanceScore = analysis.articles.relevanceScore / analysis.articles.count;
    }
  }
  
  // Analyze events
  if (structured?.events && Array.isArray(structured.events)) {
    analysis.events.count = structured.events.length;
    analysis.events.samples = structured.events.slice(0, 3).map(e => ({
      title: e.title || e.event_title || '',
      url: e.page_url || e.event_url || ''
    }));
    
    structured.events.forEach(event => {
      const title = (event.title || event.event_title || '').toLowerCase();
      const url = (event.page_url || event.event_url || '').toLowerCase();
      
      const keywordMatches = queryKeywords.filter(kw => title.includes(kw) || url.includes(kw)).length;
      const relevance = queryKeywords.length > 0 ? keywordMatches / queryKeywords.length : 0;
      
      if (relevance >= 0.3) {
        analysis.events.relevant++;
        analysis.events.relevanceScore += relevance;
      }
    });
    
    if (analysis.events.count > 0) {
      analysis.events.relevanceScore = analysis.events.relevanceScore / analysis.events.count;
    }
  }
  
  // Analyze services
  if (structured?.services && Array.isArray(structured.services)) {
    analysis.services.count = structured.services.length;
    analysis.services.samples = structured.services.slice(0, 3).map(s => ({
      title: s.title || s.service_title || '',
      url: s.page_url || s.url || ''
    }));
    
    structured.services.forEach(service => {
      const title = (service.title || service.service_title || '').toLowerCase();
      const url = (service.page_url || service.url || '').toLowerCase();
      
      const keywordMatches = queryKeywords.filter(kw => title.includes(kw) || url.includes(kw)).length;
      const relevance = queryKeywords.length > 0 ? keywordMatches / queryKeywords.length : 0;
      
      if (relevance >= 0.3) {
        analysis.services.relevant++;
        analysis.services.relevanceScore += relevance;
      }
    });
    
    if (analysis.services.count > 0) {
      analysis.services.relevanceScore = analysis.services.relevanceScore / analysis.services.count;
    }
  }
  
  // Calculate overall metrics
  analysis.overall.totalItems = analysis.articles.count + analysis.events.count + analysis.services.count + analysis.products.count;
  analysis.overall.relevantItems = analysis.articles.relevant + analysis.events.relevant + analysis.services.relevant + analysis.products.relevant;
  analysis.overall.hasRelatedInfo = analysis.overall.totalItems > 0;
  
  if (analysis.overall.totalItems > 0) {
    const totalRelevance = analysis.articles.relevanceScore * analysis.articles.count +
                          analysis.events.relevanceScore * analysis.events.count +
                          analysis.services.relevanceScore * analysis.services.count;
    analysis.overall.averageRelevance = totalRelevance / analysis.overall.totalItems;
  }
  
  return analysis;
}

// Test a single query
async function testQuery(queryObj) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: queryObj.question,
      sessionId: `quality-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });

    const options = {
      hostname: API_URL,
      port: API_PORT,
      path: API_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          // Comprehensive analysis
          const answerQuality = analyzeAnswerQuality(
            queryObj.question,
            response.answer || '',
            response.type || 'unknown'
          );
          
          const relatedInfo = analyzeRelatedInformationRelevance(
            queryObj.question,
            response.structured || {}
          );
          
          const hardcoded = detectHardcodedAnswer(
            queryObj.question,
            response.answer || '',
            response.type || 'unknown'
          );
          
          const result = {
            query: queryObj.question,
            category: queryObj.category,
            focus: queryObj.focus,
            status: res.statusCode,
            timestamp: new Date().toISOString(),
            response: {
              success: response.ok || false,
              type: response.type || 'unknown',
              answer: response.answer || '',
              answerLength: response.answer ? response.answer.length : 0,
              confidence: response.confidence || 0,
              sources: response.sources || {},
              structured: response.structured || {}
            },
            analysis: {
              answerQuality,
              relatedInformation: relatedInfo,
              hardcodedDetection: hardcoded,
              hasRelatedInfo: relatedInfo.overall.hasRelatedInfo,
              relatedInfoQuality: relatedInfo.overall.averageRelevance >= 0.5 ? 'high' : 
                                  relatedInfo.overall.averageRelevance >= 0.3 ? 'medium' : 'low'
            }
          };
          
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Generate comprehensive analysis report
function generateAnalysisReport(results) {
  const report = {
    summary: {
      totalQuestions: results.length,
      successfulTests: results.filter(r => r.status === 200).length,
      failedTests: results.filter(r => r.status !== 200).length,
      timestamp: new Date().toISOString()
    },
    answerQuality: {
      byQuality: {},
      averageScore: 0,
      totalIssues: 0,
      totalStrengths: 0
    },
    relatedInformation: {
      withRelatedInfo: 0,
      withoutRelatedInfo: 0,
      averageRelevance: 0,
      byType: {
        articles: { total: 0, relevant: 0, averageRelevance: 0 },
        events: { total: 0, relevant: 0, averageRelevance: 0 },
        services: { total: 0, relevant: 0, averageRelevance: 0 }
      }
    },
    hardcodedAnswers: {
      totalHardcoded: 0,
      byType: {},
      questions: []
    },
    routing: {
      byType: {},
      accuracy: {}
    },
    detailedResults: results
  };
  
  // Analyze results
  let totalScore = 0;
  let totalRelevance = 0;
  let relevantInfoCount = 0;
  
  results.forEach(result => {
    if (result.status !== 200) return;
    
    // Answer quality
    const quality = result.analysis.answerQuality.quality;
    report.answerQuality.byQuality[quality] = (report.answerQuality.byQuality[quality] || 0) + 1;
    totalScore += result.analysis.answerQuality.score;
    report.answerQuality.totalIssues += result.analysis.answerQuality.issues.length;
    report.answerQuality.totalStrengths += result.analysis.answerQuality.strengths.length;
    
    // Related information
    if (result.analysis.hasRelatedInfo) {
      report.relatedInformation.withRelatedInfo++;
      totalRelevance += result.analysis.relatedInformation.overall.averageRelevance;
      relevantInfoCount++;
      
      // By type
      const ri = result.analysis.relatedInformation;
      report.relatedInformation.byType.articles.total += ri.articles.count;
      report.relatedInformation.byType.articles.relevant += ri.articles.relevant;
      report.relatedInformation.byType.events.total += ri.events.count;
      report.relatedInformation.byType.events.relevant += ri.events.relevant;
      report.relatedInformation.byType.services.total += ri.services.count;
      report.relatedInformation.byType.services.relevant += ri.services.relevant;
    } else {
      report.relatedInformation.withoutRelatedInfo++;
    }
    
    // Hardcoded detection
    if (result.analysis.hardcodedDetection.isHardcoded) {
      report.hardcodedAnswers.totalHardcoded++;
      const type = result.analysis.hardcodedDetection.hardcodedType;
      report.hardcodedAnswers.byType[type] = (report.hardcodedAnswers.byType[type] || 0) + 1;
      report.hardcodedAnswers.questions.push({
        question: result.query,
        type: type,
        allTypes: result.analysis.hardcodedDetection.allTypes
      });
    }
    
    // Routing
    const responseType = result.response.type;
    report.routing.byType[responseType] = (report.routing.byType[responseType] || 0) + 1;
  });
  
  // Calculate averages
  const successfulCount = report.summary.successfulTests;
  if (successfulCount > 0) {
    report.answerQuality.averageScore = totalScore / successfulCount;
    
    if (relevantInfoCount > 0) {
      report.relatedInformation.averageRelevance = totalRelevance / relevantInfoCount;
    }
    
    // Calculate average relevance by type
    if (report.relatedInformation.byType.articles.total > 0) {
      report.relatedInformation.byType.articles.averageRelevance = 
        report.relatedInformation.byType.articles.relevant / report.relatedInformation.byType.articles.total;
    }
    if (report.relatedInformation.byType.events.total > 0) {
      report.relatedInformation.byType.events.averageRelevance = 
        report.relatedInformation.byType.events.relevant / report.relatedInformation.byType.events.total;
    }
    if (report.relatedInformation.byType.services.total > 0) {
      report.relatedInformation.byType.services.averageRelevance = 
        report.relatedInformation.byType.services.relevant / report.relatedInformation.byType.services.total;
    }
  }
  
  return report;
}

// Main test execution
async function runQualityAnalysis() {
  console.log(`\n🔍 COMPREHENSIVE RESPONSE QUALITY & RELATED INFORMATION ANALYSIS`);
  console.log(`================================================================================`);
  console.log(`📊 Test: ${testConfig.description}`);
  console.log(`📋 Questions: ${testConfig.questions.length}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`================================================================================\n`);

  const results = [];
  const startTime = Date.now();
  
  for (let i = 0; i < testConfig.questions.length; i++) {
    const question = testConfig.questions[i];
    const progress = ((i + 1) / testConfig.questions.length * 100).toFixed(1);
    
    try {
      console.log(`[${i + 1}/${testConfig.questions.length}] (${progress}%) Analyzing: "${question.question}"`);
      
      const result = await testQuery(question);
      results.push(result);
      
      // Log key metrics
      const answerQuality = result.analysis.answerQuality.quality;
      const hasRelated = result.analysis.hasRelatedInfo ? '✅' : '❌';
      const isHardcoded = result.analysis.hardcodedDetection.isHardcoded ? '🔒' : '';
      
      console.log(`  ${hasRelated} Related Info: ${result.analysis.relatedInformation.overall.totalItems} items, ` +
                  `Relevance: ${(result.analysis.relatedInformation.overall.averageRelevance * 100).toFixed(0)}%`);
      console.log(`  📝 Answer Quality: ${answerQuality} (score: ${result.analysis.answerQuality.score})`);
      if (result.analysis.hardcodedDetection.isHardcoded) {
        console.log(`  ${isHardcoded} Hardcoded: ${result.analysis.hardcodedDetection.hardcodedType}`);
      }
      
      if (result.analysis.answerQuality.issues.length > 0) {
        console.log(`  ⚠️  Issues: ${result.analysis.answerQuality.issues.join(', ')}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({
        query: question.question,
        category: question.category,
        focus: question.focus,
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: error.message,
        response: null,
        analysis: null
      });
    }
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  
  // Generate comprehensive report
  const report = generateAnalysisReport(results);
  report.summary.duration = `${duration}s`;
  
  // Save baseline
  const resultsDir = path.join(__dirname, 'test results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(resultsDir, `quality-analysis-baseline-${timestamp}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  
  // Print summary
  console.log(`\n📊 QUALITY ANALYSIS COMPLETE:`);
  console.log(`================================================================================`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Successful: ${report.summary.successfulTests}/${report.summary.totalQuestions}`);
  console.log(`\n📝 ANSWER QUALITY:`);
  console.log(`   Average Score: ${report.answerQuality.averageScore.toFixed(2)}`);
  console.log(`   Quality Distribution:`);
  Object.entries(report.answerQuality.byQuality).forEach(([quality, count]) => {
    console.log(`     ${quality}: ${count}`);
  });
  console.log(`   Total Issues: ${report.answerQuality.totalIssues}`);
  console.log(`   Total Strengths: ${report.answerQuality.totalStrengths}`);
  
  console.log(`\n🔗 RELATED INFORMATION:`);
  console.log(`   With Related Info: ${report.relatedInformation.withRelatedInfo} (${(report.relatedInformation.withRelatedInfo / report.summary.successfulTests * 100).toFixed(1)}%)`);
  console.log(`   Without Related Info: ${report.relatedInformation.withoutRelatedInfo} (${(report.relatedInformation.withoutRelatedInfo / report.summary.successfulTests * 100).toFixed(1)}%)`);
  console.log(`   Average Relevance: ${(report.relatedInformation.averageRelevance * 100).toFixed(1)}%`);
  console.log(`   Articles: ${report.relatedInformation.byType.articles.total} total, ${report.relatedInformation.byType.articles.relevant} relevant (${(report.relatedInformation.byType.articles.averageRelevance * 100).toFixed(1)}%)`);
  console.log(`   Events: ${report.relatedInformation.byType.events.total} total, ${report.relatedInformation.byType.events.relevant} relevant (${(report.relatedInformation.byType.events.averageRelevance * 100).toFixed(1)}%)`);
  console.log(`   Services: ${report.relatedInformation.byType.services.total} total, ${report.relatedInformation.byType.services.relevant} relevant (${(report.relatedInformation.byType.services.averageRelevance * 100).toFixed(1)}%)`);
  
  console.log(`\n🔒 HARDCODED ANSWERS:`);
  console.log(`   Total Hardcoded: ${report.hardcodedAnswers.totalHardcoded}`);
  console.log(`   By Type:`);
  Object.entries(report.hardcodedAnswers.byType).forEach(([type, count]) => {
    console.log(`     ${type}: ${count}`);
  });
  
  console.log(`\n🎯 ROUTING:`);
  console.log(`   By Type:`);
  Object.entries(report.routing.byType).forEach(([type, count]) => {
    console.log(`     ${type}: ${count}`);
  });
  
  console.log(`\n💾 Baseline saved to: ${filename}`);
  console.log(`================================================================================\n`);
  
  return report;
}

// Run the analysis
runQualityAnalysis().catch((error) => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});

