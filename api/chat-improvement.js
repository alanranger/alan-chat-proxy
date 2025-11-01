// /api/chat-improvement.js
// Chat improvement and insights API endpoint
// Provides analysis and recommendations for improving chat bot responses

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function sendJSON(res, status, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(obj);
}

function asString(err) {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return JSON.stringify(err);
}

/* ========== Analysis Functions ========== */

async function analyzeQuestionLogs(supa) {
  // Get questions with low confidence and high frequency
  const { data: lowConfidenceQuestions, error: lowConfError } = await supa
    .from('chat_interactions')
    .select(`
      question,
      answer,
      confidence,
      intent,
      created_at,
      sources_used,
      page_context
    `)
    .not('answer', 'is', null)
    .not('confidence', 'is', null)
    .lt('confidence', 0.6) // Low confidence threshold
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
    .order('created_at', { ascending: false });

  console.log('Found low confidence questions:', lowConfidenceQuestions?.length || 0);

  // Get already improved or ignored questions to exclude them
  const { data: excludedQuestions, error: excludeError } = await supa
    .from('content_improvement_tracking')
    .select('question')
    .in('improvement_status', ['improved', 'ignored']);

  if (excludeError) {
    console.error('Error fetching excluded questions:', excludeError);
  }

  const excludedQuestionSet = new Set(excludedQuestions?.map(q => q.question) || []);
  console.log('Excluding already processed questions:', excludedQuestionSet.size);

  // Filter out already processed questions
  const filteredQuestions = lowConfidenceQuestions?.filter(q => !excludedQuestionSet.has(q.question)) || [];
  console.log('Questions remaining after filtering:', filteredQuestions.length);

  if (lowConfError) throw new Error(`Low confidence analysis failed: ${lowConfError.message}`);

  // Group by question and calculate metrics
  const questionGroups = {};
  filteredQuestions.forEach(interaction => {
    const q = interaction.question;
    if (!questionGroups[q]) {
      questionGroups[q] = {
        question: q,
        interactions: [],
        frequency: 0,
        avgConfidence: 0,
        lastSeen: null,
        intents: new Set(),
        commonAnswers: new Map()
      };
    }
    
    questionGroups[q].interactions.push(interaction);
    questionGroups[q].frequency++;
    questionGroups[q].intents.add(interaction.intent);
    questionGroups[q].lastSeen = Math.max(
      questionGroups[q].lastSeen || 0, 
      new Date(interaction.created_at).getTime()
    );
    
    // Track common answers
    const answer = interaction.answer;
    questionGroups[q].commonAnswers.set(
      answer, 
      (questionGroups[q].commonAnswers.get(answer) || 0) + 1
    );
  });

  // Calculate average confidence for each question
  Object.values(questionGroups).forEach(group => {
    const totalConfidence = group.interactions.reduce((sum, i) => sum + (i.confidence || 0), 0);
    group.avgConfidence = totalConfidence / group.interactions.length;
  });

  // Sort by priority (focus on confidence since frequency is low)
  const prioritizedQuestions = Object.values(questionGroups)
    .map(q => ({
      ...q,
      priority: (1 - q.avgConfidence) * 100, // Focus on confidence, scale to 0-100
      intents: Array.from(q.intents),
      topAnswer: Array.from(q.commonAnswers.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'No answer',
      interactions: q.interactions // Include interactions for page context extraction
    }))
    .sort((a, b) => b.priority - a.priority);

  return prioritizedQuestions;
}

async function generateImprovementRecommendations(questionAnalysis) {
  const recommendations = [];

  for (const question of questionAnalysis.slice(0, 10)) { // Top 10 priority questions
    const rec = {
      question: question.question,
      priority: question.priority,
      frequency: question.frequency,
      avgConfidence: Math.round(question.avgConfidence * 100) / 100,
      currentAnswer: question.topAnswer,
      intents: question.intents,
      recommendations: []
    };

    // Analyze the current answer quality
    if (question.avgConfidence < 0.3) {
      rec.recommendations.push({
        type: 'content_gap',
        severity: 'high',
        message: 'Very low confidence suggests missing or inadequate content',
        action: 'Add specific content for this question type'
      });
    } else if (question.avgConfidence < 0.5) {
      rec.recommendations.push({
        type: 'content_improvement',
        severity: 'medium',
        message: 'Low confidence indicates content needs improvement',
        action: 'Enhance existing content or add more specific information'
      });
    }

    // Check for generic answers
    if (question.topAnswer.includes("I couldn't find") || 
        question.topAnswer.includes("I don't have") ||
        question.topAnswer.includes("not available")) {
      rec.recommendations.push({
        type: 'missing_content',
        severity: 'high',
        message: 'Generic "not found" response indicates missing content',
        action: 'Create specific content for this question'
      });
    }

    // Check for intent mismatches
    if (question.intents.length > 1) {
      rec.recommendations.push({
        type: 'intent_confusion',
        severity: 'medium',
        message: 'Multiple intents detected for same question',
        action: 'Clarify question intent handling'
      });
    }

    // High frequency with low confidence
    if (question.frequency > 100 && question.avgConfidence < 0.5) {
      rec.recommendations.push({
        type: 'high_impact',
        severity: 'high',
        message: 'High frequency question with poor performance',
        action: 'Priority fix - affects many users'
      });
    }

    recommendations.push(rec);
  }

  return recommendations;
}

async function createContentSuggestions(questionAnalysis) {
  const suggestions = [];

  // Group by intent to identify patterns
  const intentGroups = {};
  questionAnalysis.forEach(q => {
    q.intents.forEach(intent => {
      if (!intentGroups[intent]) intentGroups[intent] = [];
      intentGroups[intent].push(q);
    });
  });

  // Generate suggestions for each intent
  Object.entries(intentGroups).forEach(([intent, questions]) => {
    const lowConfQuestions = questions.filter(q => q.avgConfidence < 0.5);
    
    if (lowConfQuestions.length > 0) {
      suggestions.push({
        intent: intent,
        affectedQuestions: lowConfQuestions.length,
        totalQuestions: questions.length,
        avgConfidence: questions.reduce((sum, q) => sum + q.avgConfidence, 0) / questions.length,
        commonPatterns: extractCommonPatterns(lowConfQuestions),
        recommendation: generateIntentRecommendation(intent, lowConfQuestions)
      });
    }
  });

  return suggestions;
}

function extractCommonPatterns(questions) {
  const patterns = {
    keywords: new Map(),
    questionTypes: new Map()
  };

  questions.forEach(q => {
    const words = q.question.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 3) {
        patterns.keywords.set(word, (patterns.keywords.get(word) || 0) + 1);
      }
    });

    // Categorize question types
    if (q.question.toLowerCase().includes('how much') || q.question.toLowerCase().includes('cost')) {
      patterns.questionTypes.set('pricing', (patterns.questionTypes.get('pricing') || 0) + 1);
    }
    if (q.question.toLowerCase().includes('when') || q.question.toLowerCase().includes('next')) {
      patterns.questionTypes.set('scheduling', (patterns.questionTypes.get('scheduling') || 0) + 1);
    }
    if (q.question.toLowerCase().includes('where') || q.question.toLowerCase().includes('location')) {
      patterns.questionTypes.set('location', (patterns.questionTypes.get('location') || 0) + 1);
    }
  });

  return {
    topKeywords: Array.from(patterns.keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count })),
    questionTypes: Array.from(patterns.questionTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }))
  };
}

function generateIntentRecommendation(intent, questions) {
  switch (intent) {
    case 'events':
      return {
        type: 'content_expansion',
        message: 'Add more specific event information, pricing, and scheduling details',
        actions: [
          'Verify event data is up-to-date',
          'Add more detailed event descriptions',
          'Ensure pricing information is accurate'
        ]
      };
    case 'advice':
      return {
        type: 'knowledge_base_expansion',
        message: 'Expand knowledge base with more comprehensive guides and tutorials',
        actions: [
          'Create detailed guides for common topics',
          'Add step-by-step tutorials',
          'Include more practical examples'
        ]
      };
    default:
      return {
        type: 'general_improvement',
        message: 'Improve content quality and specificity',
        actions: [
          'Review and enhance existing content',
          'Add more specific information',
          'Improve answer relevance'
        ]
      };
  }
}

/* ========== Content Improvement Functions ========== */

async function generateImprovedContent(question, currentAnswer, recommendations) {
  // This would integrate with OpenAI to generate better content
  // For now, we'll create structured improvements based on the recommendations
  
  const improvements = [];
  
  // Handle invalid input
  if (!recommendations || !Array.isArray(recommendations)) {
    return improvements;
  }
  
  recommendations.forEach(rec => {
    switch (rec.type) {
      case 'content_gap':
        improvements.push({
          type: 'add_content',
          message: 'Add specific content for this question type',
          suggestedContent: generateContentForQuestion(question, question.page_context)
        });
        break;
        
      case 'missing_content':
        improvements.push({
          type: 'create_content',
          message: 'Create specific content for this question',
          suggestedContent: generateMissingContent(question)
        });
        break;
        
      case 'content_improvement':
        improvements.push({
          type: 'enhance_content',
          message: 'Enhance existing content with more specific information',
          suggestedContent: enhanceExistingContent(currentAnswer, question)
        });
        break;
    }
  });
  
  return improvements;
}

function generateContentForQuestion(question, pageContext = null) {
  const q = question.toLowerCase();
  
  // Extract context from page if available
  let pageKeywords = [];
  if (pageContext && pageContext.pathname) {
    const pathParts = pageContext.pathname.split('/').filter(part => part.length > 2);
    pageKeywords = pathParts.map(part => part.toLowerCase());
  }

  if (q.includes('book') && q.includes('english')) {
    // Context-aware book language information
    if (pageKeywords.includes('beginners') || pageKeywords.includes('course')) {
      return {
        title: 'Beginners Photography Course - Course Materials and Language',
        content: 'The Beginners Photography Course materials, including any books or guides provided, are written in English. The course is designed for English-speaking students and covers fundamental photography concepts in clear, accessible language. All course materials, handouts, and resources are provided in English to ensure comprehensive understanding.',
        keywords: ['beginners', 'course', 'book', 'guide', 'english', 'materials', 'photography'],
        intent: 'advice'
      };
    } else {
      return {
        title: 'Photography Books and Guides',
        content: 'All of Alan Ranger\'s photography books and guides are written in English. They cover topics including landscape photography, camera techniques, and post-processing methods. The books are designed for photographers of all skill levels.',
        keywords: ['book', 'guide', 'english', 'photography', 'alan ranger'],
        intent: 'advice'
      };
    }
  }

  if (q.includes('cost') && q.includes('dollar')) {
    // Context-aware pricing information
    if (pageKeywords.includes('beginners') || pageKeywords.includes('course')) {
      return {
        title: 'Beginners Photography Course - Pricing and Currency',
        content: 'The Beginners Photography Course is priced in British Pounds (GBP). The course fee includes all materials, instruction, and resources. For international students, you can use current exchange rates to convert GBP to your local currency. The pricing reflects the comprehensive nature of the course and small class sizes for personalized attention.',
        keywords: ['beginners', 'course', 'cost', 'price', 'currency', 'pound', 'gbp'],
        intent: 'events'
      };
    } else {
      return {
        title: 'Pricing Information',
        content: 'All prices are listed in British Pounds (GBP). For current exchange rates to US Dollars or other currencies, please check with your bank or currency converter. Workshop prices typically range from £150-£300 depending on duration and location.',
        keywords: ['price', 'cost', 'dollar', 'currency', 'gbp'],
        intent: 'events'
      };
    }
  }

  if (q.includes('purchase') && q.includes('guide')) {
    return {
      title: 'Purchase Guide',
      content: 'To purchase photography workshops or courses: 1) Browse available workshops on the website, 2) Select your preferred date and location, 3) Click "Book Now" to complete your purchase, 4) You\'ll receive confirmation and workshop details via email.',
      keywords: ['purchase', 'guide', 'book', 'workshop', 'course'],
      intent: 'advice'
    };
  }

  // Generic fallback
  return {
    title: 'General Information',
    content: `This question about "${question}" requires more specific content. Please add detailed information to help users get accurate answers.`,
    keywords: question.toLowerCase().split(' ').filter(w => w.length > 3),
    intent: 'advice'
  };
}

function generateMissingContent(question) {
  return {
    title: `Content for: ${question}`,
    content: `This question needs specific content to be added to the knowledge base. The current response is too generic and doesn't provide helpful information to users.`,
    keywords: question.toLowerCase().split(' ').filter(w => w.length > 3),
    intent: 'advice'
  };
}

function enhanceExistingContent(currentAnswer, question) {
  return {
    title: `Enhanced: ${question}`,
    content: `Current answer: "${currentAnswer}"\n\nThis answer could be improved with more specific details, examples, or step-by-step instructions.`,
    keywords: question.toLowerCase().split(' ').filter(w => w.length > 3),
    intent: 'advice'
  };
}

async function createContentImprovementPlan(questionAnalysis) {
  const improvementPlan = {
    highPriority: [],
    mediumPriority: [],
    contentToAdd: [],
    contentToEnhance: []
  };
  
  // Handle empty or invalid input
  if (!questionAnalysis || !Array.isArray(questionAnalysis)) {
    console.log('No question analysis data provided');
    return improvementPlan;
  }
  
  console.log('Processing', questionAnalysis.length, 'questions for improvement plan');

  for (const question of questionAnalysis) {
    // Skip if question doesn't have required properties
    if (!question || !question.question) {
      continue;
    }
    
    // Create recommendations based on confidence level
    const recommendations = [];
    if (question.avgConfidence < 0.3) {
      recommendations.push({
        type: 'content_gap',
        severity: 'high',
        message: 'Very low confidence suggests missing or inadequate content',
        action: 'Add specific content for this question type'
      });
    } else if (question.avgConfidence < 0.5) {
      recommendations.push({
        type: 'content_improvement',
        severity: 'medium',
        message: 'Low confidence indicates content needs improvement',
        action: 'Enhance existing content or add more specific information'
      });
    }
    
    // Check for generic "not found" responses
    if (question.topAnswer && question.topAnswer.toLowerCase().includes("couldn't find")) {
      recommendations.push({
        type: 'missing_content',
        severity: 'high',
        message: 'Generic "not found" response indicates missing content',
        action: 'Create specific content for this question'
      });
    }
    
    // Adjusted thresholds for your data (frequency is low, so focus on confidence)
    if (question.avgConfidence < 0.3) {
      // High priority - very low confidence (like 10%)
      const improvements = await generateImprovedContent(
        question.question, 
        question.topAnswer, 
        recommendations
      );
      
      improvementPlan.highPriority.push({
        question: question.question,
        frequency: question.frequency,
        confidence: question.avgConfidence,
        improvements
      });
    } else if (question.avgConfidence < 0.6) {
      // Medium priority - low confidence (like 50%)
      const improvements = await generateImprovedContent(
        question.question, 
        question.topAnswer, 
        recommendations
      );
      
      improvementPlan.mediumPriority.push({
        question: question.question,
        frequency: question.frequency,
        confidence: question.avgConfidence,
        improvements
      });
    }
    
    // Categorize content needs
    recommendations.forEach(rec => {
      if (rec.type === 'content_gap' || rec.type === 'missing_content') {
        improvementPlan.contentToAdd.push({
          question: question.question,
          reason: rec.message,
          suggestedContent: generateContentForQuestion(question.question, question.page_context)
        });
      } else if (rec.type === 'content_improvement') {
        improvementPlan.contentToEnhance.push({
          question: question.question,
          currentAnswer: question.topAnswer,
          reason: rec.message,
          suggestedContent: enhanceExistingContent(question.topAnswer, question.question)
        });
      }
    });
  }
  
  return improvementPlan;
}

/* ========== Handler ========== */
export default async function handler(req, res) {
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Auth
    const token = req.headers['authorization']?.trim();
    const ingest = `Bearer ${process.env.INGEST_TOKEN}`;
    const adminUi = process.env.ADMIN_UI_TOKEN ? `Bearer ${process.env.ADMIN_UI_TOKEN}` : null;
    const legacyAdmin = 'Bearer b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';
    const ok = token === ingest || (adminUi && token === adminUi) || token === legacyAdmin;
    if (!ok) return sendJSON(res, 401, { error: 'unauthorized' });

    const supa = supabaseAdmin();
    const { action } = req.query || {};

    switch (action) {
      case 'analyze':
        {
          const questionAnalysis = await analyzeQuestionLogs(supa);
          const recommendations = await generateImprovementRecommendations(questionAnalysis);
          const contentSuggestions = await createContentSuggestions(questionAnalysis);

          return sendJSON(res, 200, {
            ok: true,
            analysis: {
              totalQuestions: questionAnalysis.length,
              highPriorityCount: questionAnalysis.filter(q => q.priority > 50).length,
              avgConfidence: questionAnalysis.length > 0 
                ? questionAnalysis.reduce((sum, q) => sum + q.avgConfidence, 0) / questionAnalysis.length 
                : 0,
              recommendations,
              contentSuggestions
            }
          });
        }

      case 'recommendations':
        {
          const questionAnalysis = await analyzeQuestionLogs(supa);
          const recommendations = await generateImprovementRecommendations(questionAnalysis);

          return sendJSON(res, 200, {
            ok: true,
            recommendations: recommendations.slice(0, 20) // Top 20 recommendations
          });
        }

      case 'content_gaps':
        {
          const questionAnalysis = await analyzeQuestionLogs(supa);
          const contentSuggestions = await createContentSuggestions(questionAnalysis);

          return sendJSON(res, 200, {
            ok: true,
            contentGaps: contentSuggestions
          });
        }

      case 'improvement_plan':
        {
          try {
            const questionAnalysis = await analyzeQuestionLogs(supa);
            console.log('Question analysis result:', JSON.stringify(questionAnalysis, null, 2));
            const improvementPlan = await createContentImprovementPlan(questionAnalysis);
            console.log('Improvement plan result:', JSON.stringify(improvementPlan, null, 2));

            return sendJSON(res, 200, {
              ok: true,
              improvementPlan,
              debug: {
                questionAnalysisCount: questionAnalysis?.length || 0,
                questionAnalysis: questionAnalysis?.slice(0, 2) // First 2 for debugging
              }
            });
          } catch (error) {
            console.error('Improvement plan error:', error);
            return sendJSON(res, 500, { 
              error: 'improvement_plan_failed', 
              detail: error.message 
            });
          }
        }

      case 'generate_content':
        {
          const { question, currentAnswer, recommendations } = req.body || {};
          if (!question) {
            return sendJSON(res, 400, { error: 'bad_request', detail: 'Question is required' });
          }

          const improvements = await generateImprovedContent(question, currentAnswer, recommendations || []);

          return sendJSON(res, 200, {
            ok: true,
            question,
            improvements
          });
        }

      case 'preview_improvements':
        {
          try {
            const questionAnalysis = await analyzeQuestionLogs(supa);
            const improvementPlan = await createContentImprovementPlan(questionAnalysis);
            
            // Generate previews for top improvements
            const previews = [];
            const topQuestions = [...improvementPlan.highPriority, ...improvementPlan.mediumPriority].slice(0, 3);
            
            for (const question of topQuestions) {
              // Derive a representative page from the latest interaction's page_context
              let pagePath = null;
              if (question.interactions && question.interactions.length > 0) {
                const latest = [...question.interactions].sort((a,b)=> new Date(b.created_at)-new Date(a.created_at))[0];
                const pc = latest?.page_context || {};
                pagePath = pc.pathname || pc.url || null;
              }
              const contentResponse = await generateImprovedContent(
                question.question, 
                question.topAnswer, 
                [{ type: 'content_gap', message: 'Preview content' }]
              );
              
              previews.push({
                question: question.question,
                currentAnswer: question.topAnswer,
                confidence: question.confidence,
                pagePath,
                suggestedContent: contentResponse[0]?.suggestedContent || null
              });
            }
            
            return sendJSON(res, 200, {
              ok: true,
              previews,
              message: 'Content previews generated - review before implementing'
            });
          } catch (error) {
            console.error('Preview error:', error);
            return sendJSON(res, 500, { 
              error: 'preview_failed', 
              detail: error.message 
            });
          }
        }

      case 'improvement_status':
        {
          try {
            // Get counts of different improvement statuses
            const { data: statusCounts, error: countError } = await supa
              .from('content_improvement_tracking')
              .select('improvement_status')
              .not('improvement_status', 'is', null);

            if (countError) throw new Error(`Failed to fetch status counts: ${countError.message}`);

            // Count by status
            const counts = {
              improved: 0,
              ignored: 0,
              pending: 0,
              failed: 0
            };

            statusCounts?.forEach(item => {
              if (counts.hasOwnProperty(item.improvement_status)) {
                counts[item.improvement_status]++;
              }
            });

            // Get recent improvements with before/after data
            const { data: recentImprovements, error: improvementsError } = await supa
              .from('content_improvement_tracking')
              .select(`
                question,
                original_confidence,
                original_answer,
                improvement_status,
                implemented_at,
                page_entities!implemented_content_id (
                  title,
                  raw->>'content' as content
                )
              `)
              .eq('improvement_status', 'improved')
              .order('implemented_at', { ascending: false })
              .limit(5);

            if (improvementsError) throw new Error(`Failed to fetch recent improvements: ${improvementsError.message}`);

            return sendJSON(res, 200, {
              ok: true,
              counts,
              recentImprovements: recentImprovements || []
            });
          } catch (error) {
            console.error('Improvement status error:', error);
            return sendJSON(res, 500, { 
              error: 'improvement_status_failed', 
              detail: error.message 
            });
          }
        }

      case 'ignore_question':
        {
          const { question } = req.body || {};
          if (!question) {
            return sendJSON(res, 400, { error: 'bad_request', detail: 'Question is required' });
          }

          try {
            const { error: ignoreError } = await supa.from('content_improvement_tracking').upsert({
              question: question,
              improvement_status: 'ignored',
              ignored_at: new Date().toISOString()
            }, {
              onConflict: 'question'
            });

            if (ignoreError) throw new Error(`Failed to ignore question: ${ignoreError.message}`);

            return sendJSON(res, 200, {
              ok: true,
              message: 'Question marked as ignored'
            });
          } catch (error) {
            console.error('Ignore question error:', error);
            return sendJSON(res, 500, { 
              error: 'ignore_question_failed', 
              detail: error.message 
            });
          }
        }

      case 'list_implemented':
        {
          try {
            const { data: implementedContent, error } = await supa
              .from('page_entities')
              .select(`
                url,
                title,
                description,
                raw,
                last_seen
              `)
              .eq('raw->>source', 'automated_improvement')
              .order('last_seen', { ascending: false })
              .limit(10);

            if (error) throw new Error(`Failed to fetch implemented content: ${error.message}`);

            // Transform the data to extract the fields from raw JSONB
            const transformedContent = (implementedContent || []).map(item => ({
              url: item.url,
              title: item.title,
              description: item.description,
              source: item.raw?.source || 'automated_improvement',
              original_question: item.raw?.original_question || 'Unknown question',
              full_content: item.raw?.content || 'No content available',
              last_seen: item.last_seen
            }));

            return sendJSON(res, 200, {
              ok: true,
              implementedContent: transformedContent,
              count: transformedContent.length
            });
          } catch (error) {
            console.error('List implemented error:', error);
            return sendJSON(res, 500, { 
              error: 'list_implemented_failed', 
              detail: error.message 
            });
          }
        }

      case 'implement_improvement':
        {
          const { question, suggestedContent, approved = false } = req.body || {};
          if (!question || !suggestedContent) {
            return sendJSON(res, 400, { error: 'bad_request', detail: 'Question and suggestedContent are required' });
          }

          console.log('Implementing improvement for question:', question);
          console.log('Approved:', approved);
          console.log('Suggested content:', JSON.stringify(suggestedContent, null, 2));

          // If not approved, just return the preview
          if (!approved) {
            return sendJSON(res, 200, {
              ok: true,
              message: 'Content preview generated - approval required',
              question,
              content: suggestedContent,
              preview: true
            });
          }

          // Get original confidence for tracking
          const { data: originalInteraction } = await supa
            .from('chat_interactions')
            .select('confidence, answer')
            .eq('question', question)
            .not('confidence', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Ensure we have the required fields
          const title = suggestedContent.title || `Content for: ${question}`;
          const content = suggestedContent.content || 'Content improvement added';
          const keywords = suggestedContent.keywords || [];
          const intent = suggestedContent.intent || 'advice';

          // Add the improved content to page_entities as an article
          const newUrl = `https://www.alanranger.com/improved-content/${Date.now()}`;
          const entityHash = createHash('sha1')
            .update(JSON.stringify({ url: newUrl, kind: 'article', title }))
            .digest('hex');

          const { data: insertedContent, error: insertError } = await supa
            .from('page_entities')
            .insert([{
              url: newUrl,
            kind: 'article',
            title: title,
            description: content.substring(0, 500), // Limit description length
            raw: {
              title: title,
              content: content,
              keywords: keywords,
              intent: intent,
              source: 'automated_improvement',
              original_question: question,
              created_at: new Date().toISOString()
            },
              last_seen: new Date().toISOString(),
              entity_hash: entityHash
            }])
            .select()
            .single();

          if (insertError) {
            console.error('Insert error:', insertError);
            return sendJSON(res, 500, { error: 'insert_failed', detail: insertError.message });
          }

          // Track the improvement
          const { error: trackingError } = await supa
            .from('content_improvement_tracking')
            .upsert({
            question: question,
            original_confidence: originalInteraction?.confidence || null,
            original_answer: originalInteraction?.answer || null,
            improvement_status: 'improved',
            implemented_content_id: insertedContent.id,
            implemented_at: new Date().toISOString()
          }, {
            onConflict: 'question'
          });

          if (trackingError) {
            console.error('Tracking error:', trackingError);
            // Return warning but not fail the insert
            return sendJSON(res, 200, {
              ok: true,
              message: 'Content improvement implemented, tracking failed',
              question,
              content: suggestedContent,
              originalConfidence: originalInteraction?.confidence || null,
              trackingWarning: trackingError.message
            });
          }

          return sendJSON(res, 200, {
            ok: true,
            message: 'Content improvement implemented successfully',
            question,
            content: suggestedContent,
            originalConfidence: originalInteraction?.confidence || null
          });
        }

      default:
        return sendJSON(res, 400, { error: 'bad_request', detail: 'Valid actions: analyze, recommendations, content_gaps, improvement_plan, generate_content, implement_improvement' });
    }

  } catch (err) {
    console.error('Chat improvement error:', err);
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err) });
  }
}

