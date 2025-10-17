// Test script that uses the actual live chat.html interface
// This tests the real user experience, not just API calls

import puppeteer from 'puppeteer';

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

async function testLiveChatInterface() {
  console.log('🚀 Starting Live Chat Interface Testing');
  console.log('=====================================');
  console.log(`📅 Test run: ${new Date().toISOString()}`);
  console.log(`🌐 Testing against: https://alan-chat-proxy.vercel.app/chat.html`);
  
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for headless mode
    defaultViewport: { width: 1280, height: 720 }
  });
  
  const page = await browser.newPage();
  
  // Navigate to the live chat interface
  await page.goto('https://alan-chat-proxy.vercel.app/chat.html', { 
    waitUntil: 'networkidle2' 
  });
  
  console.log('✅ Loaded live chat interface');
  
  const results = [];
  
  for (let i = 0; i < baselineQueries.length; i++) {
    const query = baselineQueries[i];
    console.log(`\n🧪 Test ${i + 1}/${baselineQueries.length}: "${query}"`);
    
    try {
      // Clear any previous messages
      await page.evaluate(() => {
        const thread = document.querySelector('.thread');
        if (thread) {
          thread.innerHTML = '';
        }
      });
      
      // Type the query in the input field
      const inputSelector = 'input[placeholder*="Ask a question"], textarea[placeholder*="Ask a question"]';
      await page.waitForSelector(inputSelector, { timeout: 10000 });
      await page.type(inputSelector, query);
      
      // Click send button
      const sendButton = await page.$('button:has-text("Send"), button[type="submit"]');
      if (sendButton) {
        await sendButton.click();
      } else {
        // Try pressing Enter
        await page.keyboard.press('Enter');
      }
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Extract the response
      const response = await page.evaluate(() => {
        const bubbles = document.querySelectorAll('.bubble');
        const lastBubble = bubbles[bubbles.length - 1];
        
        if (!lastBubble) return null;
        
        // Check if it's a clarification response
        const clarificationOptions = lastBubble.querySelectorAll('.clarification-option');
        if (clarificationOptions.length > 0) {
          return {
            type: 'clarification',
            options: Array.from(clarificationOptions).map(opt => opt.textContent?.trim())
          };
        }
        
        // Check for events
        const eventCards = lastBubble.querySelectorAll('.event-card, .event-item');
        if (eventCards.length > 0) {
          return {
            type: 'events',
            count: eventCards.length,
            events: Array.from(eventCards).map(card => ({
              title: card.querySelector('.event-title, h3, h4')?.textContent?.trim(),
              date: card.querySelector('.event-date, .date')?.textContent?.trim(),
              location: card.querySelector('.event-location, .location')?.textContent?.trim(),
              url: card.querySelector('a')?.href
            }))
          };
        }
        
        // Check for articles
        const articleCards = lastBubble.querySelectorAll('.article-card, .article-item');
        if (articleCards.length > 0) {
          return {
            type: 'articles',
            count: articleCards.length,
            articles: Array.from(articleCards).map(card => ({
              title: card.querySelector('.article-title, h3, h4')?.textContent?.trim(),
              url: card.querySelector('a')?.href
            }))
          };
        }
        
        // Check for products
        const productCards = lastBubble.querySelectorAll('.product-card, .product-item');
        if (productCards.length > 0) {
          return {
            type: 'products',
            count: productCards.length,
            products: Array.from(productCards).map(card => ({
              title: card.querySelector('.product-title, h3, h4')?.textContent?.trim(),
              price: card.querySelector('.price')?.textContent?.trim(),
              url: card.querySelector('a')?.href
            }))
          };
        }
        
        // Check for fallback message
        const fallbackText = lastBubble.textContent?.toLowerCase();
        if (fallbackText?.includes("not entirely sure") || fallbackText?.includes("try to help")) {
          return {
            type: 'fallback',
            message: lastBubble.textContent?.trim()
          };
        }
        
        // Generic response
        return {
          type: 'text',
          content: lastBubble.textContent?.trim()
        };
      });
      
      // Get confidence from footer
      const confidence = await page.evaluate(() => {
        const footer = document.querySelector('.footer-status');
        if (footer) {
          const confBadge = footer.querySelector('.badge.conf');
          if (confBadge) {
            const text = confBadge.textContent;
            const match = text.match(/(\d+)%/);
            return match ? parseInt(match[1]) : null;
          }
        }
        return null;
      });
      
      const result = {
        id: i + 1,
        query,
        response,
        confidence,
        timestamp: new Date().toISOString()
      };
      
      results.push(result);
      
      console.log(`✅ Response type: ${response?.type || 'unknown'}`);
      console.log(`📊 Confidence: ${confidence || 'unknown'}%`);
      
      if (response?.type === 'events') {
        console.log(`📅 Events found: ${response.count}`);
      } else if (response?.type === 'clarification') {
        console.log(`🤔 Clarification options: ${response.options?.length || 0}`);
      } else if (response?.type === 'fallback') {
        console.log(`⚠️  Fallback message detected`);
      }
      
      // Wait between tests
      await page.waitForTimeout(2000);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      results.push({
        id: i + 1,
        query,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  await browser.close();
  
  // Save results
  const fs = await import('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `results/live-chat-interface-test-${timestamp}.json`;
  
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results', { recursive: true });
  }
  
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  
  console.log('\n🏁 Live chat interface testing completed');
  console.log(`📁 Results saved to: ${filename}`);
  
  // Summary
  const successful = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;
  const fallbacks = results.filter(r => r.response?.type === 'fallback').length;
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successful: ${successful}/15`);
  console.log(`   ❌ Failed: ${failed}/15`);
  console.log(`   ⚠️  Fallbacks: ${fallbacks}/15`);
  
  if (fallbacks > 0) {
    console.log(`\n⚠️  Fallback responses (need investigation):`);
    results.filter(r => r.response?.type === 'fallback').forEach(r => {
      console.log(`   ${r.id}. ${r.query}`);
    });
  }
  
  return results;
}

// Run the test
testLiveChatInterface().catch(console.error);
