import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_URL = "https://alan-chat-proxy.vercel.app/chat.html";
const INTERACTIVE_URL = "https://alan-chat-proxy.vercel.app/interactive-testing.html";
const OUTPUT_JSON = path.resolve(__dirname, "results", `live-pages-comparison-${Date.now()}.json`);

const testQueries = [
  "what is exposure",
  "what is exposure triangle", 
  "do you have photography courses",
  "what camera do i need for your courses",
  "do you do commercial photography"
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
    await page.waitForTimeout(3000);
    
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
    
    let responseType = 'unknown';
    if (hasDirectAnswer && !hasArticleLinks) {
      responseType = 'direct_answer';
    } else if (hasArticleLinks && !hasDirectAnswer) {
      responseType = 'article_links';
    } else if (hasDirectAnswer && hasArticleLinks) {
      responseType = 'hybrid';
    } else {
      responseType = 'minimal';
    }
    
    console.log(`Response Type: ${responseType}`);
    console.log(`Answer Length: ${fullResponse.length} chars`);
    console.log(`Answer Preview: ${fullResponse.substring(0, 200)}...`);
    
    return {
      url: CHAT_URL,
      question,
      responseType,
      answerLength: fullResponse.length,
      answerPreview: fullResponse.substring(0, 300),
      fullResponse,
      hasDirectAnswer,
      hasArticleLinks
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
    await page.waitForTimeout(2000);
    
    // Look for the question input or test interface
    // This might be different - let's see what's available
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
  console.log('🔍 TESTING LIVE PAGES COMPARISON');
  console.log('='.repeat(60));
  console.log('Testing both live chat and interactive testing pages...\n');
  
  const browser = await chromium.launch({ headless: false, channel: "chromium" });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  
  for (const question of testQueries) {
    console.log(`\n🔍 Testing: "${question}"`);
    console.log('='.repeat(60));
    
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
    
    console.log('\n' + '='.repeat(60));
  }
  
  await browser.close();
  
  // Save results
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${OUTPUT_JSON}`);
  
  // Summary
  console.log('\n📈 SUMMARY:');
  const chatResults = results.filter(r => r.url === CHAT_URL);
  const interactiveResults = results.filter(r => r.url === INTERACTIVE_URL);
  
  console.log(`Chat page tested: ${chatResults.length} questions`);
  console.log(`Interactive page tested: ${interactiveResults.length} questions`);
  
  const contentDifferences = results.filter((r, i) => i % 2 === 1 && r.answerPreview !== results[i-1].answerPreview);
  console.log(`Questions with different content: ${contentDifferences.length}/${testQueries.length}`);
})();
