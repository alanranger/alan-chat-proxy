// Exhaustive Clarification Path Testing
// Tests every branch of clarification paths with depth limit
// Based on BASELINE_REGRESSION_SUITE.md instructions

import fs from 'fs';
import path from 'path';

const baselineQueries = [
  "What is your refund and cancellation policy?",
  "When is the next Lightroom course in Coventry?",
  "Do you still run Lake District photography workshops?",
  "How much is the Lightroom beginners course?",
  "Can I book a 1-to-1 mentoring session with Alan?",
  "Do you have tips for composition or leading lines?",
  "Show me an article about the exposure triangle.",
  "How do I set ISO manually on my camera?",
  "What's the difference between aperture and shutter speed?",
  "When is the best time of day for landscape photography?",
  "Where do your workshops meet and start from?",
  "Do you provide transport or accommodation?",
  "How do I join the Photography Academy?",
  "How do module exams and certificates work?",
  "Who is Alan Ranger?"
];

class ClarificationExplorer {
  constructor(maxDepth = 3, delayMs = 1000) {
    this.maxDepth = maxDepth;
    this.delayMs = delayMs;
    this.results = [];
    this.visitedPaths = new Set();
  }

  async delay() {
    return new Promise(resolve => setTimeout(resolve, this.delayMs));
  }

  async makeRequest(query, sessionId) {
    try {
      const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          sessionId: sessionId
        })
      });
      
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }

  generatePathKey(query, depth, optionIndex) {
    return `${query.substring(0, 50)}_d${depth}_o${optionIndex}`;
  }

  async exploreClarificationPath(originalQuery, currentQuery, depth, pathHistory, sessionId) {
    if (depth > this.maxDepth) {
      console.log(`🛑 Max depth reached for: ${currentQuery}`);
      return;
    }

    const pathKey = this.generatePathKey(currentQuery, depth, 0);
    if (this.visitedPaths.has(pathKey)) {
      console.log(`🔄 Skipping duplicate path: ${currentQuery}`);
      return;
    }
    this.visitedPaths.add(pathKey);

    console.log(`\n🔍 Depth ${depth}: "${currentQuery}"`);
    console.log(`📚 Path: ${pathHistory.join(' → ')}`);

    const response = await this.makeRequest(currentQuery, sessionId);
    
    if (response.error) {
      console.log(`❌ Error: ${response.error}`);
      this.results.push({
        originalQuery,
        currentQuery,
        depth,
        pathHistory: [...pathHistory],
        error: response.error,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const result = {
      originalQuery,
      currentQuery,
      depth,
      pathHistory: [...pathHistory],
      response: response,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);

    // If this is a clarification response with options, explore each branch
    if (response.type === 'clarification' && response.options && response.options.length > 0) {
      console.log(`🤔 Found ${response.options.length} clarification options:`);
      response.options.forEach((option, index) => {
        console.log(`   ${index + 1}. ${option.text}`);
      });

      // Explore each clarification option
      for (let i = 0; i < response.options.length; i++) {
        const option = response.options[i];
        const nextQuery = option.query || option.text;
        const nextPathHistory = [...pathHistory, `${i + 1}. ${option.text}`];
        
        console.log(`\n🌿 Exploring branch ${i + 1}: "${nextQuery}"`);
        
        await this.delay(); // Rate limiting
        await this.exploreClarificationPath(
          originalQuery,
          nextQuery,
          depth + 1,
          nextPathHistory,
          sessionId
        );
      }
    } else {
      console.log(`✅ Final response type: ${response.type}`);
      if (response.type === 'events' && response.structured?.events) {
        console.log(`   📅 Events found: ${response.structured.events.length}`);
      }
      if (response.type === 'advice' && response.structured?.articles) {
        console.log(`   📰 Articles found: ${response.structured.articles.length}`);
      }
    }
  }

  async runExhaustiveTest(queries = baselineQueries) {
    console.log('🚀 Starting Exhaustive Clarification Path Testing');
    console.log('================================================');
    console.log(`📅 Test run: ${new Date().toISOString()}`);
    console.log(`🔧 Max depth: ${this.maxDepth}`);
    console.log(`⏱️  Delay between requests: ${this.delayMs}ms`);
    console.log(`📝 Queries to test: ${queries.length}`);

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`\n\n🧪 Testing Query ${i + 1}/${queries.length}: "${query}"`);
      console.log('='.repeat(80));
      
      const sessionId = `exhaustive-test-${Date.now()}-${i}`;
      await this.exploreClarificationPath(query, query, 0, ['Initial Query'], sessionId);
      
      // Delay between different original queries
      if (i < queries.length - 1) {
        console.log(`\n⏳ Waiting ${this.delayMs}ms before next query...`);
        await this.delay();
      }
    }

    console.log('\n🏁 Exhaustive testing completed');
    return this.results;
  }

  saveResults(outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${outputPath}-${timestamp}.json`;
    
    // Create output directory if it doesn't exist
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`📁 Results saved to: ${filename}`);
    
    // Generate summary
    const summary = this.generateSummary();
    const summaryFilename = filename.replace('.json', '-summary.json');
    fs.writeFileSync(summaryFilename, JSON.stringify(summary, null, 2));
    console.log(`📊 Summary saved to: ${summaryFilename}`);
    
    return filename;
  }

  generateSummary() {
    const totalPaths = this.results.length;
    const clarificationPaths = this.results.filter(r => r.response?.type === 'clarification').length;
    const finalPaths = this.results.filter(r => r.response?.type !== 'clarification').length;
    const errorPaths = this.results.filter(r => r.error).length;
    
    const maxDepthReached = Math.max(...this.results.map(r => r.depth));
    
    const responseTypes = {};
    this.results.forEach(r => {
      if (r.response?.type) {
        responseTypes[r.response.type] = (responseTypes[r.response.type] || 0) + 1;
      }
    });
    
    return {
      timestamp: new Date().toISOString(),
      totalPaths: totalPaths,
      clarificationPaths: clarificationPaths,
      finalPaths: finalPaths,
      errorPaths: errorPaths,
      maxDepthReached: maxDepthReached,
      responseTypes: responseTypes,
      uniqueOriginalQueries: [...new Set(this.results.map(r => r.originalQuery))].length,
      averageDepth: this.results.reduce((sum, r) => sum + r.depth, 0) / totalPaths
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let outputPath = 'results/exhaustive-clarifications';
  let maxDepth = 3;
  let delayMs = 1000;
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    } else if (args[i] === '--max-depth' && args[i + 1]) {
      maxDepth = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delayMs = parseInt(args[i + 1]);
      i++;
    }
  }
  
  console.log(`🎯 Output path: ${outputPath}`);
  console.log(`🔧 Max depth: ${maxDepth}`);
  console.log(`⏱️  Delay: ${delayMs}ms`);
  
  const explorer = new ClarificationExplorer(maxDepth, delayMs);
  await explorer.runExhaustiveTest();
  const filename = explorer.saveResults(outputPath);
  
  console.log('\n✅ Exhaustive clarification testing completed!');
  console.log(`📁 Full results: ${filename}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ClarificationExplorer, baselineQueries };
