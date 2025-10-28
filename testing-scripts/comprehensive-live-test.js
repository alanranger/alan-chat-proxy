import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_URL = "https://alan-chat-proxy.vercel.app/chat.html";
const INTERACTIVE_URL = "https://alan-chat-proxy.vercel.app/interactive-testing.html";
const OUTPUT_JSON = path.resolve(__dirname, "results", `comprehensive-live-test-${Date.now()}.json`);

// Comprehensive test queries covering all question types
const testQueries = [
  // WHAT questions
  "what is exposure",
  "what is exposure triangle", 
  "what is iso",
  "what is aperture",
  "what is shutter speed",
  "what is depth of field",
  "what is white balance",
  "what is raw format",
  "what is histogram",
  "what is composition",
  "what is rule of thirds",
  "what is leading lines",
  "what is golden hour",
  "what is blue hour",
  "what is hdr photography",
  "what is macro photography",
  "what is street photography",
  "what is portrait photography",
  "what is landscape photography",
  "what is wildlife photography",
  "what is sports photography",
  "what is wedding photography",
  "what is event photography",
  "what is commercial photography",
  "what is fine art photography",
  "what is documentary photography",
  "what is travel photography",
  "what is architectural photography",
  "what is food photography",
  
  // WHEN questions
  "when is the best time to take photos",
  "when should I use a tripod",
  "when do you run photography courses",
  "when is golden hour",
  "when should I use flash",
  "when is the best time for landscape photography",
  "when do you have workshops",
  "when should I use manual mode",
  "when is blue hour",
  "when should I use a polarizing filter",
  
  // WHY questions
  "why are my photos blurry",
  "why do I need a good camera",
  "why is composition important",
  "why do you teach photography",
  "why should I take your course",
  "why is lighting important",
  "why do photos look different on camera vs computer",
  "why is post-processing necessary",
  "why do you recommend certain cameras",
  "why is practice important in photography",
  
  // DO I questions
  "do I need a DSLR camera",
  "do I need to understand technical settings",
  "do I need expensive equipment",
  "do I need to know about lighting",
  "do I need to edit my photos",
  "do I need to understand composition",
  "do I need to practice regularly",
  "do I need to understand the exposure triangle",
  "do I need to know about different lenses",
  "do I need to understand camera settings",
  
  // DO YOU questions
  "do you teach beginners",
  "do you offer online courses",
  "do you have group workshops",
  "do you provide equipment",
  "do you teach post-processing",
  "do you offer one-to-one tuition",
  "do you have advanced courses",
  "do you teach specific photography styles",
  "do you provide course materials",
  "do you offer certification",
  
  // WHERE questions
  "where do you teach",
  "where can I learn photography",
  "where are your workshops held",
  "where can I find your courses",
  "where do you recommend taking photos",
  "where can I buy photography equipment",
  "where are the best photography locations",
  "where can I practice photography",
  "where do you offer online learning",
  "where can I get photography advice",
  
  // HOW questions
  "how do I take sharp photos",
  "how do I improve my photography",
  "how do I choose the right camera",
  "how do I understand camera settings",
  "how do I learn photography",
  "how do I take better portraits",
  "how do I photograph landscapes",
  "how do I use lighting effectively",
  "how do I edit photos",
  "how do I develop my photography skills"
];

async function hardClear(page) {
  try { await page.context().clearCookies(); } catch {}
  await page.goto("about:blank");
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try { if (window.caches) caches.keys().then(keys => keys.forEach(k => caches.delete(k))); } catch {}
    try { if (window.indexedDB && indexedDB.databases) indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name))); } catch {}
  });
}

async function testChatPage(page, question) {
  console.log(`\n🔍 Testing chat.html with: "${question}"`);
  console.log('-'.repeat(50));
  
  try {
    await page.goto(CHAT_URL, { waitUntil: "domcontentloaded" });
    
    // Turn off sound
    try {
      const soundToggle = page.getByRole('checkbox', { name: /Sound/i });
      if (await soundToggle.isVisible().catch(() => false)) {
        if (await soundToggle.isChecked()) {
          await soundToggle.click();
        }
      }
    } catch {}
    
    // Wait for input and send question
    await page.waitForSelector('.composer input, textarea, input[placeholder*="Ask a question" i]', { timeout: 15000 });
    const input = page.locator('.composer input').first().or(page.locator('input[placeholder*="Ask a question" i]')).or(page.locator('textarea'));
    await input.fill("");
    await input.type(question, { delay: 5 });
    const sendBtn = page.getByRole('button', { name: /Send/i }).or(page.locator('button:has-text("Send")'));
    await sendBtn.click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Get the response content
    const responseElements = await page.locator('.bubble:not(.user)').all();
    const responses = [];
    
    for (const element of responseElements) {
      const text = await element.textContent();
      if (text && text.trim()) {
        responses.push(text.trim());
      }
    }
    
    const fullResponse = responses.join(' ');
    const hasDirectAnswer = fullResponse.length > 50 && !fullResponse.includes('http');
    const hasArticleLinks = fullResponse.includes('http');
    const hasEvents = fullResponse.includes('event') || fullResponse.includes('workshop') || fullResponse.includes('course');
    
    let responseType = 'unknown';
    if (hasDirectAnswer && !hasArticleLinks && !hasEvents) {
      responseType = 'direct_answer';
    } else if (hasArticleLinks && !hasDirectAnswer && !hasEvents) {
      responseType = 'article_links';
    } else if (hasEvents && !hasDirectAnswer && !hasArticleLinks) {
      responseType = 'events';
    } else if (hasDirectAnswer && (hasArticleLinks || hasEvents)) {
      responseType = 'hybrid';
    } else {
      responseType = 'minimal';
    }
    
    console.log(`Response Type: ${responseType}`);
    console.log(`Answer Length: ${fullResponse.length} chars`);
    console.log(`Has Direct Answer: ${hasDirectAnswer}`);
    console.log(`Has Article Links: ${hasArticleLinks}`);
    console.log(`Has Events: ${hasEvents}`);
    console.log(`Answer Preview: ${fullResponse.substring(0, 200)}...`);
    
    return {
      url: CHAT_URL,
      question,
      responseType,
      answerLength: fullResponse.length,
      answerPreview: fullResponse.substring(0, 300),
      fullResponse,
      hasDirectAnswer,
      hasArticleLinks,
      hasEvents
    };
    
  } catch (error) {
    console.error(`Error testing chat page: ${error.message}`);
    return {
      url: CHAT_URL,
      question,
      error: error.message,
      responseType: 'error',
      answerLength: 0,
      answerPreview: error.message
    };
  }
}

async function testInteractivePage(page, question) {
  console.log(`\n🧪 Testing interactive-testing.html with: "${question}"`);
  console.log('-'.repeat(50));
  
  try {
    await page.goto(INTERACTIVE_URL, { waitUntil: "domcontentloaded" });
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    // Look for the question input or test interface
    const pageContent = await page.content();
    console.log('Page loaded, looking for input elements...');
    
    // Try to find input elements
    const inputs = await page.locator('input, textarea').all();
    console.log(`Found ${inputs.length} input elements`);
    
    // For now, let's just capture what we can see
    const allText = await page.textContent('body');
    const hasQuestion = allText.includes(question);
    
    console.log(`Page contains question: ${hasQuestion}`);
    console.log(`Page text length: ${allText.length}`);
    console.log(`Page preview: ${allText.substring(0, 200)}...`);
    
    return {
      url: INTERACTIVE_URL,
      question,
      responseType: 'interactive_page',
      answerLength: allText.length,
      answerPreview: allText.substring(0, 300),
      fullResponse: allText,
      hasQuestion,
      note: 'Interactive testing page - may need different approach'
    };
    
  } catch (error) {
    console.error(`Error testing interactive page: ${error.message}`);
    return {
      url: INTERACTIVE_URL,
      question,
      error: error.message,
      responseType: 'error',
      answerLength: 0,
      answerPreview: error.message
    };
  }
}

(async () => {
  console.log('🔍 COMPREHENSIVE LIVE TEST');
  console.log('='.repeat(80));
  console.log(`Testing ${testQueries.length} questions across all types...`);
  console.log('Question types: WHAT, WHEN, WHY, DO I, DO YOU, WHERE, HOW\n');
  
  const browser = await chromium.launch({ headless: false, channel: "chromium" });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  
  for (let i = 0; i < testQueries.length; i++) {
    const question = testQueries[i];
    console.log(`\n🔍 Testing ${i + 1}/${testQueries.length}: "${question}"`);
    console.log('='.repeat(80));
    
    // Test chat.html
    await hardClear(page);
    const chatResult = await testChatPage(page, question);
    results.push(chatResult);
    
    // Test interactive-testing.html
    await hardClear(page);
    const interactiveResult = await testInteractivePage(page, question);
    results.push(interactiveResult);
    
    // Compare results
    console.log(`\n📊 COMPARISON FOR: "${question}"`);
    console.log(`Chat Response Type: ${chatResult.responseType}`);
    console.log(`Interactive Response Type: ${interactiveResult.responseType}`);
    console.log(`Chat Answer Length: ${chatResult.answerLength} chars`);
    console.log(`Interactive Answer Length: ${interactiveResult.answerLength} chars`);
    
    const contentDifferent = chatResult.answerPreview !== interactiveResult.answerPreview;
    console.log(`Content Different: ${contentDifferent ? 'YES' : 'NO'}`);
    
    if (contentDifferent) {
      console.log('\n📝 CONTENT DIFFERENCES:');
      console.log('Chat Answer:', chatResult.answerPreview);
      console.log('Interactive Answer:', interactiveResult.answerPreview);
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  await browser.close();
  
  // Save results
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${OUTPUT_JSON}`);
  
  // Summary analysis
  console.log('\n📈 COMPREHENSIVE SUMMARY:');
  console.log('='.repeat(80));
  
  const chatResults = results.filter(r => r.url === CHAT_URL);
  const interactiveResults = results.filter(r => r.url === INTERACTIVE_URL);
  
  console.log(`Chat page tested: ${chatResults.length} questions`);
  console.log(`Interactive page tested: ${interactiveResults.length} questions`);
  
  // Analyze response types
  const chatResponseTypes = chatResults.map(r => r.responseType);
  const interactiveResponseTypes = interactiveResults.map(r => r.responseType);
  
  console.log('\n📊 CHAT PAGE RESPONSE TYPES:');
  const chatTypeCounts = {};
  chatResponseTypes.forEach(type => {
    chatTypeCounts[type] = (chatTypeCounts[type] || 0) + 1;
  });
  Object.entries(chatTypeCounts).forEach(([type, count]) => {
    console.log(`- ${type}: ${count}`);
  });
  
  console.log('\n📊 INTERACTIVE PAGE RESPONSE TYPES:');
  const interactiveTypeCounts = {};
  interactiveResponseTypes.forEach(type => {
    interactiveTypeCounts[type] = (interactiveTypeCounts[type] || 0) + 1;
  });
  Object.entries(interactiveTypeCounts).forEach(([type, count]) => {
    console.log(`- ${type}: ${count}`);
  });
  
  // Content differences
  const contentDifferences = results.filter((r, i) => i % 2 === 1 && r.answerPreview !== results[i-1].answerPreview);
  console.log(`\n📊 Questions with different content: ${contentDifferences.length}/${testQueries.length}`);
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Review the comprehensive results');
  console.log('2. Identify patterns by question type');
  console.log('3. Determine which approach works better for each type');
  console.log('4. Implement the optimal solution');
})();
