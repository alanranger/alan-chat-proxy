const http = require('http');

async function debugConceptExtraction() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: "what is exposure triangle",
      sessionId: 'debug-session'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          
          console.log('🔍 DEBUG: Concept Extraction Analysis');
          console.log('='.repeat(50));
          console.log(`Query: "what is exposure triangle"`);
          console.log(`Answer: ${response.answer?.substring(0, 200)}...`);
          console.log(`Sources: ${response.sources?.length || 0}`);
          console.log(`Articles: ${response.structured?.articles?.length || 0}`);
          
          // Check if the answer contains triangle-related content
          const answerLower = (response.answer || '').toLowerCase();
          const hasTriangle = answerLower.includes('triangle');
          const hasAperture = answerLower.includes('aperture');
          const hasShutter = answerLower.includes('shutter');
          const hasIso = answerLower.includes('iso');
          const hasRelationship = answerLower.includes('relationship') || answerLower.includes('between');
          
          console.log('\n📊 Content Analysis:');
          console.log(`Contains "triangle": ${hasTriangle}`);
          console.log(`Contains "aperture": ${hasAperture}`);
          console.log(`Contains "shutter": ${hasShutter}`);
          console.log(`Contains "iso": ${hasIso}`);
          console.log(`Contains relationship words: ${hasRelationship}`);
          
          if (response.structured?.articles) {
            console.log('\n📚 Article Analysis:');
            response.structured.articles.forEach((article, i) => {
              const titleLower = (article.title || '').toLowerCase();
              const hasTriangleInTitle = titleLower.includes('triangle');
              const hasExposureInTitle = titleLower.includes('exposure');
              console.log(`${i + 1}. "${article.title}" - Triangle: ${hasTriangleInTitle}, Exposure: ${hasExposureInTitle}`);
            });
          }
          
          resolve(response);
        } catch (e) {
          console.error('Parse error:', e.message);
          console.log('Raw response:', responseData.substring(0, 500));
          resolve({ error: e.message });
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e.message);
      resolve({ error: e.message });
    });

    req.write(postData);
    req.end();
  });
}

debugConceptExtraction();
