const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const failedQuestions = [
  "do I need a laptop for lightroom course",
  "do you provide photography courses", 
  "when are your next bluebell workshops",
  "do you have autumn workshops",
  "tell me about rps mentoring",
  "do you have a lightroom course",
  "do you do commercial photography",
  "do you do portrait photography",
  "why are my images always grainy and noisy"
];

async function captureScreenshots() {
  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, 'failed-questions-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: false, // Set to true if you don't want to see the browser
    slowMo: 1000 // Slow down for better screenshots
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to the chat interface
    console.log('🌐 Navigating to chat interface...');
    await page.goto('http://localhost:3000');
    
    // Wait for the chat interface to load
    await page.waitForSelector('input[type="text"], textarea, [data-testid="chat-input"]', { timeout: 10000 });
    
    console.log('📸 Starting screenshot capture for 9 failed questions...');
    
    for (let i = 0; i < failedQuestions.length; i++) {
      const question = failedQuestions[i];
      console.log(`\n🔍 Testing Question ${i + 1}: "${question}"`);
      
      try {
        // Clear any existing text and type the question
        const inputSelector = 'input[type="text"], textarea, [data-testid="chat-input"], #chat-input';
        await page.click(inputSelector);
        await page.fill(inputSelector, '');
        await page.type(inputSelector, question);
        
        // Submit the question
        await page.press(inputSelector, 'Enter');
        
        // Wait for response to load (wait for response elements to appear)
        await page.waitForTimeout(3000);
        
        // Wait for response content to appear
        await page.waitForSelector('[data-testid="chat-message"], .message, .response, .answer', { timeout: 10000 });
        
        // Take screenshot
        const screenshotPath = path.join(screenshotsDir, `question-${i + 1}-${question.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}.png`);
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
        
        console.log(`✅ Screenshot saved: ${screenshotPath}`);
        
        // Wait a moment before next question
        await page.waitForTimeout(2000);
        
      } catch (error) {
        console.log(`❌ Error with question ${i + 1}: ${error.message}`);
        
        // Take screenshot even if there's an error
        const screenshotPath = path.join(screenshotsDir, `question-${i + 1}-ERROR-${question.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)}.png`);
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
      }
    }
    
    console.log(`\n🎉 Screenshot capture complete! Check the 'failed-questions-screenshots' folder.`);
    
  } catch (error) {
    console.error('❌ Error during screenshot capture:', error);
  } finally {
    await browser.close();
  }
}

// Check if Playwright is installed
try {
  require('playwright');
  captureScreenshots().catch(console.error);
} catch (error) {
  console.log('❌ Playwright not installed. Installing...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install playwright', { stdio: 'inherit' });
    console.log('✅ Playwright installed. Please run the script again.');
  } catch (installError) {
    console.error('❌ Failed to install Playwright:', installError.message);
  }
}









