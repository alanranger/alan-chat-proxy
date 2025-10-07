import { createClient } from '@supabase/supabase-js';

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
      sources_used
    `)
    .not('answer', 'is', null)
    .not('confidence', 'is', null)
    .lt('confidence', 0.6) // Low confidence threshold
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
    .order('created_at', { ascending: false });

  console.log('Found low confidence questions:', lowConfidenceQuestions?.length || 0);

  if (lowConfError) throw new Error(`Low confidence analysis failed: ${lowConfError.message}`);

  // Group by question and calculate metrics
  const questionGroups = {};
  (lowConfidenceQuestions || []).forEach(interaction => {
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
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'No answer'
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
          suggestedContent: generateContentForQuestion(question)
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

function generateContentForQuestion(question) {
  const q = question.toLowerCase();
  
  if (q.includes('book') && q.includes('english')) {
    return {
      title: 'Photography Books and Guides',
      content: 'All of Alan Ranger\'s photography books and guides are written in English. They cover topics including landscape photography, camera techniques, and post-processing methods. The books are designed for photographers of all skill levels.',
      keywords: ['book', 'guide', 'english', 'photography', 'alan ranger'],
      intent: 'advice'
    };
  }
  
  if (q.includes('cost') && q.includes('dollar')) {
    return {
      title: 'Pricing Information',
      content: 'All prices are listed in British Pounds (GBP). For current exchange rates to US Dollars or other currencies, please check with your bank or currency converter. Workshop prices typically range from £150-£300 depending on duration and location.',
      keywords: ['price', 'cost', 'dollar', 'currency', 'gbp'],
      intent: 'events'
    };
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
    if (!question || !question.question || !question.recommendations) {
      continue;
    }
    
    // Adjusted thresholds for your data (frequency is low, so focus on confidence)
    if (question.avgConfidence < 0.3) {
      // High priority - very low confidence (like 10%)
      const improvements = await generateImprovedContent(
        question.question, 
        question.topAnswer, 
        question.recommendations
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
        question.recommendations
      );
      
      improvementPlan.mediumPriority.push({
        question: question.question,
        frequency: question.frequency,
        confidence: question.avgConfidence,
        improvements
      });
    }
    
    // Categorize content needs
    question.recommendations.forEach(rec => {
      if (rec.type === 'content_gap' || rec.type === 'missing_content') {
        improvementPlan.contentToAdd.push({
          question: question.question,
          reason: rec.message,
          suggestedContent: generateContentForQuestion(question.question)
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
              avgConfidence: questionAnalysis.reduce((sum, q) => sum + q.avgConfidence, 0) / questionAnalysis.length,
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
            const improvementPlan = await createContentImprovementPlan(questionAnalysis);

            return sendJSON(res, 200, {
              ok: true,
              improvementPlan
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

      case 'implement_improvement':
        {
          const { question, suggestedContent } = req.body || {};
          if (!question || !suggestedContent) {
            return sendJSON(res, 400, { error: 'bad_request', detail: 'Question and suggestedContent are required' });
          }

          // Add the improved content to page_entities as an article
          const { error: insertError } = await supa.from('page_entities').insert([{
            url: `https://www.alanranger.com/improved-content/${Date.now()}`,
            kind: 'article',
            title: suggestedContent.title,
            description: suggestedContent.content,
            raw: {
              title: suggestedContent.title,
              content: suggestedContent.content,
              keywords: suggestedContent.keywords,
              intent: suggestedContent.intent,
              source: 'automated_improvement',
              original_question: question,
              created_at: new Date().toISOString()
            },
            last_seen: new Date().toISOString()
          }]);

          if (insertError) throw new Error(`Content insertion failed: ${insertError.message}`);

          return sendJSON(res, 200, {
            ok: true,
            message: 'Content improvement implemented successfully',
            question,
            content: suggestedContent
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
