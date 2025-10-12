// Script to re-ingest blog articles with FAQPage content
// Using built-in fetch

// List of blog articles that need re-ingesting (from the database query)
const blogArticlesToReingest = [
  "https://www.alanranger.com/blog-on-photography/10-basic-camera-settings-for-camera",
  "https://www.alanranger.com/blog-on-photography/7-essential-camera-accessories",
  "https://www.alanranger.com/blog-on-photography/architecture-photography-guide",
  "https://www.alanranger.com/blog-on-photography/are-camera-uv-filters-worth-it",
  "https://www.alanranger.com/blog-on-photography/are-mirrorless-cameras-better-than-dslrs",
  "https://www.alanranger.com/blog-on-photography/art-of-macro-photography",
  "https://www.alanranger.com/blog-on-photography/best-camera-bags-for-different-trips",
  "https://www.alanranger.com/blog-on-photography/best-product-photography-tripod",
  "https://www.alanranger.com/blog-on-photography/black-and-white-photography-for-beginners",
  "https://www.alanranger.com/blog-on-photography/camera-lenses-hire-or-buy",
  "https://www.alanranger.com/blog-on-photography/camera-sensor-cleaning-guide",
  "https://www.alanranger.com/blog-on-photography/creative-photography-workshops-unlocking-your-potential",
  "https://www.alanranger.com/blog-on-photography/creative-potential-with-nik-collection-7",
  "https://www.alanranger.com/blog-on-photography/exposure-bracketing-a-guide-for-photographers",
  "https://www.alanranger.com/blog-on-photography/finding-your-compositional-balance",
  "https://www.alanranger.com/blog-on-photography/five-creative-autumn-photography-projects",
  "https://www.alanranger.com/blog-on-photography/full-frame-vs-cropped-sensor",
  "https://www.alanranger.com/blog-on-photography/guide-preparing-for-your-photography-workshop",
  "https://www.alanranger.com/blog-on-photography/how-much-do-photographers-earn",
  "https://www.alanranger.com/blog-on-photography/how-to-back-up-photos",
  "https://www.alanranger.com/blog-on-photography/how-to-find-your-photography-style",
  "https://www.alanranger.com/blog-on-photography/how-to-improve-your-photography-composition",
  "https://www.alanranger.com/blog-on-photography/how-to-take-long-exposure-photos",
  "https://www.alanranger.com/blog-on-photography/how-to-take-professional-photos",
  "https://www.alanranger.com/blog-on-photography/jpeg-vs-raw-the-key-differences",
  "https://www.alanranger.com/blog-on-photography/kentfaith-concept-square-filter-system",
  "https://www.alanranger.com/blog-on-photography/learn-landscape-photography-techniques",
  "https://www.alanranger.com/blog-on-photography/lightroom-classic-latest-version-whats-new",
  "https://www.alanranger.com/blog-on-photography/manfrotto-befree-tripod-review",
  "https://www.alanranger.com/blog-on-photography/mastering-abstract-photography",
  "https://www.alanranger.com/blog-on-photography/mastering-landscape-photography-tips-and-techniques",
  "https://www.alanranger.com/blog-on-photography/mastering-photography-composition-rules",
  "https://www.alanranger.com/blog-on-photography/mastering-the-art-of-seasonal-photography",
  "https://www.alanranger.com/blog-on-photography/mastering-the-art-of-shadow-photography",
  "https://www.alanranger.com/blog-on-photography/photo-editing-software",
  "https://www.alanranger.com/blog-on-photography/photo-print-sizes-resize-photos",
  "https://www.alanranger.com/blog-on-photography/photography-concepts-for-beginners",
  "https://www.alanranger.com/blog-on-photography/photography-is-an-art-of-observation",
  "https://www.alanranger.com/blog-on-photography/photography-styles-trends-and-tips",
  "https://www.alanranger.com/blog-on-photography/prepare-for-photography-courses",
  "https://www.alanranger.com/blog-on-photography/product-photography-setup",
  "https://www.alanranger.com/blog-on-photography/professional-commercial-photography-in-coventry",
  "https://www.alanranger.com/blog-on-photography/selecting-the-ideal-product-photographer",
  "https://www.alanranger.com/blog-on-photography/social-media-for-photographers-tips",
  "https://www.alanranger.com/blog-on-photography/street-photography-tips",
  "https://www.alanranger.com/blog-on-photography/take-the-on-line-colour-test",
  "https://www.alanranger.com/blog-on-photography/the-art-of-storytelling-photography",
  "https://www.alanranger.com/blog-on-photography/the-history-of-photography",
  "https://www.alanranger.com/blog-on-photography/top-bluebell-woodland-tips",
  "https://www.alanranger.com/blog-on-photography/top-tips-for-photographing-bluebells",
  "https://www.alanranger.com/blog-on-photography/tripod-for-cameras-essential-guide",
  "https://www.alanranger.com/blog-on-photography/what-are-camera-drive-modes",
  "https://www.alanranger.com/blog-on-photography/what-are-leading-lines-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-do-camera-lens-filters-do",
  "https://www.alanranger.com/blog-on-photography/what-is-aperture-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-contrast-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-depth-of-field",
  "https://www.alanranger.com/blog-on-photography/what-is-dynamic-range-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-exposure-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-focal-length-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-focus-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-framing-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-iso-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-manual-exposure-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-metering-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-minimalist-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-negative-space-in-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-portrait-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-shutter-speed",
  "https://www.alanranger.com/blog-on-photography/what-is-still-life-photography",
  "https://www.alanranger.com/blog-on-photography/what-is-white-balance-in-photography"
];

async function reingestBlogArticles() {
  console.log('=== RE-INGESTING BLOG ARTICLES WITH FAQPAGE CONTENT ===\n');
  console.log(`Total articles to re-ingest: ${blogArticlesToReingest.length}\n`);
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  // Process articles in batches of 5 to avoid overwhelming the system
  const batchSize = 5;
  for (let i = 0; i < blogArticlesToReingest.length; i += batchSize) {
    const batch = blogArticlesToReingest.slice(i, i + batchSize);
    console.log(`\n--- Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} articles) ---`);
    
    // Process each article in the batch
    for (const url of batch) {
      try {
        console.log(`Re-ingesting: ${url}`);
        
        // Call the ingest API
        const response = await fetch('https://chat-ai-bot-eta.vercel.app/api/ingest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INGEST_TOKEN || 'test-token'}`
          },
          body: JSON.stringify({
            url: url,
            dryRun: false
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`  ✅ Success - Chunks: ${result.chunks}, Entities: ${result.entities}, JSON-LD: ${result.jsonLdFound}`);
          successCount++;
        } else {
          const errorText = await response.text();
          console.log(`  ❌ Failed - Status: ${response.status}, Error: ${errorText.substring(0, 100)}...`);
          errorCount++;
          errors.push({ url, status: response.status, error: errorText });
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        errorCount++;
        errors.push({ url, error: error.message });
      }
    }
    
    // Longer delay between batches
    if (i + batchSize < blogArticlesToReingest.length) {
      console.log('Waiting 5 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Summary
  console.log('\n=== RE-INGEST SUMMARY ===');
  console.log(`Total articles: ${blogArticlesToReingest.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(`Success rate: ${((successCount / blogArticlesToReingest.length) * 100).toFixed(1)}%`);
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach((error, i) => {
      console.log(`${i + 1}. ${error.url} - ${error.status || 'Error'}: ${error.error?.substring(0, 100)}...`);
    });
  }
  
  if (successCount > 0) {
    console.log('\n🎯 SUCCESS! Blog articles have been re-ingested with the JSON-LD fix.');
    console.log('The chat bot should now have access to FAQPage data for technical questions.');
  }
}

// Run the re-ingest
reingestBlogArticles().catch(console.error);
