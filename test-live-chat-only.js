import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_URL = "https://alan-chat-proxy.vercel.app/chat.html";
const OUTPUT_JSON = path.resolve(__dirname, "results", `live-chat-baseline-${Date.now()}.json`);

const testQueries = [
  "what is exposure",
  "what is aperture", 
  "what is iso",
  "what is shutter speed",
  "what is white balance",
  "who is alan ranger",
  "when is your next photography course",
  "do you have tips for composition"
];

async function testLiveChat(page, question) {
  console.log(`\n🔍 Testing live chat with: "${question}"`);
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
    await page.waitForSelector('.composer input', { timeout: 15000 });
    
    const input = page.locator('.composer input').first();
    await input.fill(question);
    await input.press('Enter');
    
    // Wait for response (look for bubble elements)
    await page.waitForSelector('.bubble:not(.user)', { timeout: 30000 });
    
    // Wait for typing indicator to disappear
    await page.waitForFunction(() => {
      const bubbles = document.querySelectorAll('.bubble:not(.user)');
      const lastBubble = bubbles[bubbles.length - 1];
      return lastBubble && !lastBubble.querySelector('.typing');
    }, { timeout: 30000 });
    
    // Get the response from the last bubble that's not a user message
    const response = await page.locator('.bubble:not(.user):last-child').innerHTML();
    const confidence = await page.locator('.badge.conf').textContent().catch(() => 'N/A');
    
    console.log(`✅ Response: ${response.substring(0, 100)}...`);
    console.log(`📊 Confidence: ${confidence}`);
    
    return {
      question,
      response: response.trim(),
      confidence: confidence.trim(),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return {
      question,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function runLiveChatTest() {
  console.log('🚀 Starting Live Chat Bot Test');
  console.log(`📡 Testing: ${CHAT_URL}`);
  console.log(`📅 Test started: ${new Date().toISOString()}`);
  
  const browser = await chromium.launch({ 
    headless: false,  // Show browser window
    slowMo: 1000     // Slow down for visibility
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = [];
  
  try {
    for (const query of testQueries) {
      const result = await testLiveChat(page, query);
      results.push(result);
      
      // Wait between questions
      await page.waitForTimeout(2000);
    }
    
    // Save results
    const output = {
      timestamp: new Date().toISOString(),
      url: CHAT_URL,
      testType: 'live-chat-baseline',
      results
    };
    
    // Ensure results directory exists
    const resultsDir = path.dirname(OUTPUT_JSON);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
    
    console.log(`\n📄 Results saved to: ${OUTPUT_JSON}`);
    console.log(`📊 Tested ${results.length} queries`);
    
  } finally {
    await browser.close();
  }
}

runLiveChatTest().catch(console.error);
