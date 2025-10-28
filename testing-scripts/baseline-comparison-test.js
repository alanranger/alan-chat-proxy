import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAT_URL = "https://alan-chat-proxy.vercel.app/chat.html";
const OUTPUT_JSON = path.resolve(__dirname, "results", `baseline-comparison-${Date.now()}.json`);

// 50 comprehensive test questions covering all types
const testQueries = [
  // WHAT questions (10)
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
  
  // WHY questions (10)
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
  
  // WHEN questions (10)
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
  
  // HOW questions (10)
  "how do I take sharp photos",
  "how do I improve my photography",
  "how do I choose the right camera",
  "how do I understand camera settings",
  "how do I learn photography",
  "how do I take better portraits",
  "how do I photograph landscapes",
  "how do I use lighting effectively",
  "how do I edit photos",
  "how do I develop my photography skills",
  
  // DO I questions (10)
  "do I need a DSLR camera",
  "do I need to understand technical settings",
  "do I need expensive equipment",
  "do I need to know about lighting",
  "do I need to edit my photos",
  "do I need to understand composition",
  "do I need to practice regularly",
  "do I need to understand the exposure triangle",
  "do I need to know about different lenses",
  "do I need to understand camera settings"
];

// ChatGPT-style answers for comparison
const chatgptAnswers = {
  "what is exposure": "Exposure in photography refers to the amount of light that reaches your camera's sensor when you take a photo. It's controlled by three main settings: aperture (how wide the lens opening is), shutter speed (how long the sensor is exposed to light), and ISO (the sensor's sensitivity to light). Getting the right exposure means balancing these three settings so your photo isn't too dark (underexposed) or too bright (overexposed).",
  
  "what is exposure triangle": "The Exposure Triangle consists of three key settings that control how much light reaches your camera's sensor: Aperture (f-stop) controls depth of field and light, Shutter Speed controls motion blur and light, and ISO controls sensor sensitivity and light. These three settings work together - changing one affects the others, so you need to balance them to achieve proper exposure while getting your desired creative effects.",
  
  "what is iso": "ISO in photography refers to your camera sensor's sensitivity to light. Lower ISO values (like 100-400) mean less sensitivity and produce cleaner images with less noise, but require more light. Higher ISO values (like 1600-6400) make the sensor more sensitive to light, allowing you to shoot in darker conditions, but can introduce grain or noise. The key is finding the right balance for your lighting conditions.",
  
  "what is aperture": "Aperture refers to the opening in your camera lens that controls how much light enters the camera. It's measured in f-stops (like f/2.8, f/5.6, f/11). A wider aperture (lower f-number like f/2.8) lets in more light and creates a shallow depth of field (blurred background). A smaller aperture (higher f-number like f/11) lets in less light but creates a deeper depth of field (more of the image in focus).",
  
  "what is shutter speed": "Shutter speed is how long your camera's sensor is exposed to light when taking a photo. It's measured in fractions of a second (like 1/60, 1/250, 1/1000). Faster shutter speeds (like 1/1000) freeze motion and let in less light. Slower shutter speeds (like 1/30) let in more light but can create motion blur. The right shutter speed depends on your subject and lighting conditions.",
  
  "what is depth of field": "Depth of field refers to how much of your image is in sharp focus. A shallow depth of field (blurred background) is created by wide apertures (low f-numbers like f/2.8) and is great for portraits. A deep depth of field (everything in focus) is created by small apertures (high f-numbers like f/11) and is ideal for landscapes. The distance between you and your subject also affects depth of field.",
  
  "what is white balance": "White balance is a camera setting that ensures colors in your photos look natural under different lighting conditions. Different light sources (sunlight, fluorescent, tungsten) have different color temperatures. White balance adjusts your camera to compensate for these color differences so whites appear white and colors look accurate. You can set it manually or use auto white balance.",
  
  "what is raw format": "RAW format is an uncompressed image file that contains all the data captured by your camera sensor. Unlike JPEG files, RAW files aren't processed by the camera, giving you complete control over editing. RAW files are larger but offer much more flexibility for adjusting exposure, white balance, and other settings in post-processing. Most professional photographers shoot in RAW for maximum editing potential.",
  
  "what is histogram": "A histogram is a graph that shows the distribution of tones in your image, from pure black (left) to pure white (right). It helps you evaluate exposure - a good histogram typically has data spread across the graph without clipping at either end. Learning to read histograms helps you achieve proper exposure and understand the tonal range of your images.",
  
  "what is composition": "Composition in photography is how you arrange elements within your frame to create visually appealing images. Key principles include the rule of thirds (placing subjects on imaginary grid lines), leading lines (using lines to guide the viewer's eye), framing (using elements to frame your subject), and balance (distributing visual weight). Good composition can make even simple subjects look compelling.",
  
  "why are my photos blurry": "Blurry photos are usually caused by camera shake, subject movement, or focusing issues. To fix this: use a faster shutter speed (at least 1/focal length), hold your camera steady, use proper focusing techniques, ensure adequate lighting, and consider using a tripod for slower shutter speeds. Practice proper camera holding technique and learn to use your camera's autofocus effectively.",
  
  "why do I need a good camera": "While a good camera can help, it's not the most important factor in photography. Technique, composition, and understanding light matter more than equipment. However, a good camera offers better image quality, more control over settings, better low-light performance, and more creative options. Start with what you can afford and focus on learning the fundamentals first.",
  
  "why is composition important": "Composition is crucial because it determines how viewers interact with your image. Good composition guides the eye, creates visual interest, and can make even ordinary subjects compelling. It's about arranging elements in your frame to tell a story or create an emotional response. Strong composition can elevate a simple subject, while poor composition can ruin a great scene.",
  
  "why do you teach photography": "I teach photography because I believe everyone can learn to create meaningful images. Photography is both technical skill and artistic expression, and I enjoy helping people develop both aspects. Teaching others also deepens my own understanding and keeps me connected to the joy of discovery that makes photography so rewarding.",
  
  "why should I take your course": "My courses offer structured learning with personalized feedback, practical exercises, and real-world application. I focus on building both technical skills and creative vision, with hands-on experience and ongoing support. Whether you're a beginner or looking to advance, my approach helps you develop your unique photographic voice while mastering the fundamentals.",
  
  "why is lighting important": "Lighting is fundamental to photography because it shapes how we see and photograph subjects. Good lighting can transform an ordinary scene into something extraordinary, while poor lighting can ruin even the best composition. Understanding light - its direction, quality, color, and intensity - is essential for creating compelling images and controlling mood and atmosphere.",
  
  "why do photos look different on camera vs computer": "Photos often look different because camera screens are small and bright, while computer monitors are larger and may have different color profiles. Camera screens are optimized for viewing in various lighting conditions, while monitors are calibrated for specific viewing environments. The difference can also be due to different color spaces, screen brightness, and viewing distance.",
  
  "why is post-processing necessary": "Post-processing isn't always necessary, but it's a powerful tool for realizing your creative vision. It allows you to adjust exposure, enhance colors, correct white balance, and apply creative effects. Even minor adjustments can significantly improve an image. Think of it as the digital equivalent of darkroom techniques used in film photography.",
  
  "why do you recommend certain cameras": "I recommend cameras based on your specific needs, budget, and experience level. Different cameras excel at different things - some are better for beginners, others for professionals. I consider factors like image quality, ease of use, lens selection, and your intended subjects. The goal is finding equipment that supports your learning and creative goals.",
  
  "why is practice important in photography": "Practice is essential because photography combines technical skill with artistic vision. You need to develop muscle memory for camera controls, learn to see light and composition, and develop your creative eye. Regular practice helps you internalize techniques so you can focus on creativity. Like any skill, photography improves with consistent, mindful practice.",
  
  "when is the best time to take photos": "The best time depends on your subject and desired mood. Golden hour (first hour after sunrise, last hour before sunset) offers warm, soft light ideal for most photography. Blue hour (before sunrise, after sunset) provides cool, even lighting. Midday sun can be harsh but works for certain subjects. Overcast days offer soft, even light perfect for portraits and details.",
  
  "when should I use a tripod": "Use a tripod when you need stability for slow shutter speeds, want to ensure sharp focus, are shooting in low light, need to compose carefully, or want to take multiple identical shots for blending. Tripods are essential for landscape photography, long exposures, macro work, and any situation where camera shake could ruin your shot.",
  
  "when do you run photography courses": "I run photography courses throughout the year, with both online and in-person options. Course schedules vary by season and include beginner workshops, advanced techniques, and specialized topics like landscape or portrait photography. I also offer one-on-one tuition and group sessions. Check my website for current course offerings and schedules.",
  
  "when is golden hour": "Golden hour occurs during the first hour after sunrise and the last hour before sunset. This is when the sun is low in the sky, creating warm, soft, directional light that's flattering for most subjects. The exact timing varies by season and location, but it's generally the most beautiful light for photography, especially for portraits and landscapes.",
  
  "when should I use flash": "Use flash when you need additional light, want to fill in shadows, need to freeze motion, or want to create specific lighting effects. Flash is useful in low light situations, for fill light in bright conditions, and for creative lighting. Learn to use flash effectively - it's not just for dark situations but a powerful creative tool.",
  
  "when is the best time for landscape photography": "The best times are during golden hour (sunrise and sunset) and blue hour (before sunrise, after sunset). These times offer the most dramatic lighting and colors. Early morning often has clearer air and less wind. Weather conditions like storms, fog, or dramatic clouds can create exceptional landscape opportunities at any time.",
  
  "when do you have workshops": "I offer workshops throughout the year, both online and in-person. Workshop topics include beginner photography, advanced techniques, specific genres like landscape or portrait photography, and specialized skills like post-processing. Check my website for current workshop schedules and availability.",
  
  "when should I use manual mode": "Use manual mode when you want complete control over exposure settings, are shooting in challenging lighting conditions, want consistent results across multiple shots, or are learning to understand the relationship between aperture, shutter speed, and ISO. It's also useful for creative effects like intentional over or under exposure.",
  
  "when is blue hour": "Blue hour occurs during the 20-30 minutes before sunrise and after sunset when the sky takes on a deep blue color. This happens when the sun is below the horizon but still illuminates the upper atmosphere. It's ideal for cityscapes, architecture, and creating moody, atmospheric images with even, cool lighting.",
  
  "when should I use a polarizing filter": "Use a polarizing filter to reduce reflections from water, glass, or wet surfaces, to darken blue skies and make clouds pop, to reduce atmospheric haze, and to saturate colors in landscapes. It's most effective when the sun is at a 90-degree angle to your shooting direction. Rotate the filter to achieve the desired effect.",
  
  "how do I take sharp photos": "To take sharp photos: use a fast enough shutter speed to avoid camera shake (at least 1/focal length), hold your camera steady with proper technique, ensure accurate focus, use adequate lighting, consider using a tripod for slower speeds, and practice proper breathing and hand positioning. Sharp images come from good technique, not just expensive equipment.",
  
  "how do I improve my photography": "Improve your photography by: practicing regularly with intention, studying composition and lighting, learning your camera's capabilities, analyzing your own work critically, studying other photographers' work, experimenting with different techniques, seeking feedback, and focusing on one skill at a time. Consistent practice with mindful attention to improvement is key.",
  
  "how do I choose the right camera": "Choose a camera based on your budget, experience level, and intended use. Consider: image quality needs, ease of use, lens selection, size and weight, and future growth potential. For beginners, start with entry-level DSLR or mirrorless. For serious hobbyists, mid-range models offer better features. The best camera is one you'll use regularly.",
  
  "how do I understand camera settings": "Learn camera settings by understanding the exposure triangle: aperture controls depth of field and light, shutter speed controls motion and light, ISO controls sensitivity and noise. Start with one setting at a time, practice in different lighting conditions, and learn how they affect each other. Understanding comes through practice and experimentation.",
  
  "how do I learn photography": "Learn photography through: structured courses or tutorials, regular practice with specific goals, studying composition and lighting, analyzing other photographers' work, experimenting with different techniques, seeking feedback, and gradually building your skills. Start with fundamentals like exposure and composition, then explore creative techniques.",
  
  "how do I take better portraits": "Take better portraits by: understanding lighting (natural light, positioning, direction), learning composition (rule of thirds, framing, angles), connecting with your subject, using appropriate settings (aperture for depth of field, shutter speed for sharpness), choosing good backgrounds, and practicing regularly. The key is making your subject feel comfortable and confident.",
  
  "how do I photograph landscapes": "Photograph landscapes by: scouting locations and timing (golden hour, weather), using appropriate equipment (wide-angle lens, tripod, filters), understanding composition (leading lines, rule of thirds, foreground interest), considering lighting and weather conditions, and being patient for the right moment. Landscape photography often requires multiple visits to get the perfect shot.",
  
  "how do I use lighting effectively": "Use lighting effectively by: understanding natural light (direction, quality, color), learning to see and modify light (reflectors, diffusers), understanding how light affects mood and atmosphere, practicing with different lighting conditions, and learning to work with available light before adding artificial sources. Good lighting can transform any subject.",
  
  "how do I edit photos": "Edit photos by: starting with basic adjustments (exposure, contrast, color), learning your editing software's capabilities, developing a consistent workflow, practicing with different styles, and learning to enhance rather than over-process. Good editing should support your creative vision, not replace good photography fundamentals.",
  
  "how do I develop my photography skills": "Develop photography skills by: setting specific learning goals, practicing regularly with intention, studying composition and lighting, experimenting with different techniques, seeking feedback and critique, learning from other photographers, and gradually building your technical and creative abilities. Consistent, mindful practice is the key to improvement.",
  
  "do I need a DSLR camera": "You don't necessarily need a DSLR camera. Modern mirrorless cameras, high-end smartphones, and even point-and-shoot cameras can produce excellent results. The key is understanding your equipment's capabilities and limitations. For beginners, any camera that allows manual control over settings is sufficient to learn the fundamentals.",
  
  "do I need to understand technical settings": "Understanding technical settings is important for creative control, but you don't need to master everything at once. Start with the basics: aperture, shutter speed, and ISO. Learn how they affect your images and practice with one setting at a time. Technical knowledge gives you the tools to realize your creative vision.",
  
  "do I need expensive equipment": "Expensive equipment isn't necessary for good photography. Technique, composition, and understanding light matter more than gear. Start with what you can afford and focus on learning the fundamentals. You can create compelling images with any modern camera if you understand the basics and practice regularly.",
  
  "do I need to know about lighting": "Understanding lighting is crucial for photography because it shapes how we see and photograph subjects. You don't need to be an expert immediately, but learning to see and work with light is fundamental. Start with natural light, learn to observe its direction and quality, and practice in different lighting conditions.",
  
  "do I need to edit my photos": "Editing isn't always necessary, but it's a powerful tool for realizing your creative vision. Even basic adjustments can significantly improve an image. Start with simple edits like exposure and color adjustments, then gradually learn more advanced techniques. Good editing should enhance your photography, not replace good fundamentals.",
  
  "do I need to understand composition": "Understanding composition is essential for creating compelling images. It's about arranging elements in your frame to guide the viewer's eye and create visual interest. Learn basic principles like the rule of thirds, leading lines, and framing. Good composition can make even simple subjects look compelling.",
  
  "do I need to practice regularly": "Regular practice is essential for developing photography skills. Like any skill, photography improves with consistent, mindful practice. Set aside time for regular shooting, even if it's just a few minutes a day. Practice with intention, focusing on specific skills or techniques you want to improve.",
  
  "do I need to understand the exposure triangle": "Understanding the exposure triangle (aperture, shutter speed, ISO) is fundamental to photography. These three settings work together to control exposure and creative effects. You don't need to master everything at once, but learning how they affect each other gives you creative control over your images.",
  
  "do I need to know about different lenses": "Understanding different lenses helps you choose the right tool for your subject and creative vision. Wide-angle lenses are great for landscapes, telephoto lenses for wildlife or sports, and standard lenses for general photography. Start with one versatile lens and learn its capabilities before expanding your collection.",
  
  "do I need to understand camera settings": "Understanding camera settings gives you creative control over your images. You don't need to master everything immediately, but learning the basics - aperture, shutter speed, ISO, and focus - allows you to realize your creative vision. Start with one setting at a time and practice until it becomes second nature."
};

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

async function testChatBot(page, question) {
  console.log(`\n🔍 Testing: "${question}"`);
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
    console.error(`Error testing: ${error.message}`);
    return {
      question,
      error: error.message,
      responseType: 'error',
      answerLength: 0,
      answerPreview: error.message
    };
  }
}

(async () => {
  console.log('🔍 BASELINE COMPARISON TEST');
  console.log('='.repeat(80));
  console.log(`Testing ${testQueries.length} questions to compare ChatBot vs ChatGPT responses\n`);
  
  const browser = await chromium.launch({ headless: false, channel: "chromium" });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  
  for (let i = 0; i < testQueries.length; i++) {
    const question = testQueries[i];
    console.log(`\n🔍 Testing ${i + 1}/${testQueries.length}: "${question}"`);
    console.log('='.repeat(80));
    
    // Test chat bot
    await hardClear(page);
    const chatBotResult = await testChatBot(page, question);
    
    // Get ChatGPT answer for comparison
    const chatgptAnswer = chatgptAnswers[question] || "No ChatGPT answer available for comparison";
    
    // Compare responses
    console.log(`\n📊 COMPARISON FOR: "${question}"`);
    console.log(`ChatBot Response Type: ${chatBotResult.responseType}`);
    console.log(`ChatBot Answer Length: ${chatBotResult.answerLength} chars`);
    console.log(`ChatBot Has Direct Answer: ${chatBotResult.hasDirectAnswer}`);
    console.log(`ChatBot Has Article Links: ${chatBotResult.hasArticleLinks}`);
    console.log(`ChatBot Has Events: ${chatBotResult.hasEvents}`);
    
    console.log(`\nChatGPT Answer Length: ${chatgptAnswer.length} chars`);
    console.log(`ChatGPT Answer: ${chatgptAnswer.substring(0, 200)}...`);
    
    // Analyze quality
    const chatBotDirect = chatBotResult.hasDirectAnswer;
    const chatBotQuality = chatBotResult.answerLength > 100 && chatBotResult.hasDirectAnswer;
    const chatgptQuality = chatgptAnswer.length > 100;
    
    let qualityAssessment = 'unknown';
    if (chatBotQuality && chatgptQuality) {
      qualityAssessment = 'both_good';
    } else if (chatBotQuality && !chatgptQuality) {
      qualityAssessment = 'chatbot_better';
    } else if (!chatBotQuality && chatgptQuality) {
      qualityAssessment = 'chatgpt_better';
    } else {
      qualityAssessment = 'both_poor';
    }
    
    console.log(`\nQuality Assessment: ${qualityAssessment}`);
    
    results.push({
      question,
      chatBot: chatBotResult,
      chatgpt: {
        answer: chatgptAnswer,
        answerLength: chatgptAnswer.length
      },
      qualityAssessment
    });
    
    console.log('\n' + '='.repeat(80));
  }
  
  await browser.close();
  
  // Save results
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${OUTPUT_JSON}`);
  
  // Summary analysis
  console.log('\n📈 BASELINE COMPARISON SUMMARY:');
  console.log('='.repeat(80));
  
  const qualityCounts = {};
  results.forEach(r => {
    qualityCounts[r.qualityAssessment] = (qualityCounts[r.qualityAssessment] || 0) + 1;
  });
  
  console.log('\n📊 QUALITY ASSESSMENT:');
  Object.entries(qualityCounts).forEach(([assessment, count]) => {
    console.log(`- ${assessment}: ${count}/${results.length}`);
  });
  
  const responseTypes = {};
  results.forEach(r => {
    responseTypes[r.chatBot.responseType] = (responseTypes[r.chatBot.responseType] || 0) + 1;
  });
  
  console.log('\n📊 CHATBOT RESPONSE TYPES:');
  Object.entries(responseTypes).forEach(([type, count]) => {
    console.log(`- ${type}: ${count}/${results.length}`);
  });
  
  console.log('\n🎯 KEY FINDINGS:');
  console.log('1. Compare ChatBot vs ChatGPT response quality');
  console.log('2. Identify which questions need improvement');
  console.log('3. Determine patterns in response types');
  console.log('4. Plan improvements based on results');
})();
