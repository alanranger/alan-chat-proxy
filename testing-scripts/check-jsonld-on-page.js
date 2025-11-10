import https from 'https';

const url = 'https://www.alanranger.com/photo-workshops-uk/woodland-photography-walk-warwickshire';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const jsonLdMatches = data.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      console.log(`Found ${jsonLdMatches.length} JSON-LD scripts:\n`);
      jsonLdMatches.forEach((match, i) => {
        const content = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        try {
          const json = JSON.parse(content);
          if (Array.isArray(json)) {
            console.log(`${i+1}. Array with ${json.length} items:`);
            json.forEach((item, idx) => {
              console.log(`   [${idx}] Type: ${item['@type'] || 'Unknown'}`);
            });
          } else {
            console.log(`${i+1}. Type: ${json['@type'] || 'Unknown'}`);
            if (json['@type'] === 'Event' || json['@type'] === 'Product') {
              console.log(`   ⭐ This is an Event/Product!`);
              if (json.startDate) console.log(`   Start Date: ${json.startDate}`);
              if (json.offers) console.log(`   Offers: ${JSON.stringify(json.offers)}`);
            }
          }
        } catch (e) {
          console.log(`${i+1}. Parse error: ${e.message}`);
        }
      });
    } else {
      console.log('No JSON-LD scripts found');
    }
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});

