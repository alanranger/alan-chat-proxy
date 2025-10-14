// Test current system against business owner specifications
const testQuestions = [
    {
        id: 1,
        userQuestion: "do you do photography courses?",
        expectedIntent: "advice",
        expectedKind: "service",
        expectedUrls: ["https://www.alanranger.com/free-online-photography-course"]
    },
    {
        id: 2,
        userQuestion: "what beginners photography courses do you have?",
        expectedIntent: "advice",
        expectedKind: "product",
        expectedUrls: ["https://www.alanranger.com/beginners-photography-classes"]
    },
    {
        id: 3,
        userQuestion: "do you run photography workshops?",
        expectedIntent: "events",
        expectedKind: "event",
        expectedUrls: [
            "https://www.alanranger.com/bluebell-woods-near-me/",
            "https://www.alanranger.com/photo-workshops-uk/bluebell-woodlands-photography-workshops",
            "https://www.alanranger.com/photographic-workshops-near-me (bluebells)"
        ]
    },
    {
        id: 4,
        userQuestion: "what camera should I buy?",
        expectedIntent: "advice",
        expectedKind: "article",
        expectedUrls: ["https://www.alanranger.com/blog-on-photography/choosing-a-camera/"]
    },
    {
        id: 5,
        userQuestion: "who is Alan Ranger?",
        expectedIntent: "advice",
        expectedKind: "landing",
        expectedUrls: ["https://www.alanranger.com/about-alan-ranger"]
    },
    {
        id: 6,
        userQuestion: "what photography services do you offer?",
        expectedIntent: "advice",
        expectedKind: "service",
        expectedUrls: [
            "https://www.alanranger.com/private-photography-lessons",
            "https://www.alanranger.com/photography-lessons-online-121"
        ]
    },
    {
        id: 7,
        userQuestion: "is there a free online photography course?",
        expectedIntent: "advice",
        expectedKind: "landing",
        expectedUrls: [
            "https://www.alanranger.com/free-online-photography-course",
            "https://www.alanranger.com/online-photography-course"
        ]
    },
    {
        id: 8,
        userQuestion: "when is the next bluebell photography workshop?",
        expectedIntent: "advice",
        expectedKind: "mixed",
        expectedUrls: [
            "https://www.alanranger.com/photo-workshops-uk/bluebell-woodlands-photography-workshops",
            "https://www.alanranger.com/photographic-workshops-near-me/"
        ]
    },
    {
        id: 9,
        userQuestion: "how do I use manual mode on my camera?",
        expectedIntent: "advice",
        expectedKind: "article",
        expectedUrls: [
            "https://www.alanranger.com/blog-on-photography/what-is-manual-exposure-in-photography",
            "https://www.alanranger.com/blog-on-photography/what-is-exposure-in-photography",
            "https://www.alanranger.com/blog-on-photography/free-outdoor-photography-exposure-calculator"
        ]
    },
    {
        id: 10,
        userQuestion: "what's the best lens for portrait photography?",
        expectedIntent: "advice",
        expectedKind: "article",
        expectedUrls: [
            "https://www.alanranger.com/photography-equipment-recommendations",
            "https://www.alanranger.com/blog-on-photography/choosing-a-camera",
            "https://prf.hn/click/camref:1011lrfGr/creativeref:1101l88284"
        ]
    },
    {
        id: 11,
        userQuestion: "do you offer one-to-one photography lessons?",
        expectedIntent: "advice",
        expectedKind: "service",
        expectedUrls: [
            "https://www.alanranger.com/private-photography-lessons",
            "https://www.alanranger.com/photography-lessons-online-121"
        ]
    }
];

async function testCurrentSystem() {
    console.log("🧪 Testing Current System vs Business Owner Specifications\n");
    console.log("=" * 80);
    
    let totalTests = 0;
    let intentMatches = 0;
    let kindMatches = 0;
    let urlMatches = 0;
    let partialUrlMatches = 0;
    
    for (const test of testQuestions) {
        totalTests++;
        console.log(`\n📋 Question ${test.id}: ${test.userQuestion}`);
        console.log("-".repeat(60));
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: test.userQuestion,
                    history: []
                })
            });
            
            const data = await response.json();
            
            // Extract actual values
            const actualIntent = data.structured?.intent || 'undefined';
            const actualKind = getActualKind(data.structured);
            const actualUrls = getActualUrls(data.structured);
            
            // Check intent match
            const intentMatch = actualIntent === test.expectedIntent;
            if (intentMatch) intentMatches++;
            
            // Check kind match
            const kindMatch = actualKind === test.expectedKind;
            if (kindMatch) kindMatches++;
            
            // Check URL matches
            const urlMatchResult = checkUrlMatches(actualUrls, test.expectedUrls);
            if (urlMatchResult.exact) urlMatches++;
            if (urlMatchResult.partial) partialUrlMatches++;
            
            // Display results
            console.log(`Expected Intent: ${test.expectedIntent}`);
            console.log(`Actual Intent:   ${actualIntent} ${intentMatch ? '✅' : '❌'}`);
            console.log(`Expected Kind:   ${test.expectedKind}`);
            console.log(`Actual Kind:     ${actualKind} ${kindMatch ? '✅' : '❌'}`);
            console.log(`Expected URLs:   ${test.expectedUrls.length} URLs`);
            console.log(`Actual URLs:     ${actualUrls.length} URLs`);
            
            if (urlMatchResult.exact) {
                console.log(`URL Match:       Perfect match ✅`);
            } else if (urlMatchResult.partial) {
                console.log(`URL Match:       Partial match ⚠️`);
                console.log(`  Expected: ${test.expectedUrls.join(', ')}`);
                console.log(`  Actual:   ${actualUrls.join(', ')}`);
            } else {
                console.log(`URL Match:       No match ❌`);
                console.log(`  Expected: ${test.expectedUrls.join(', ')}`);
                console.log(`  Actual:   ${actualUrls.join(', ')}`);
            }
            
            // Show answer preview
            const answerPreview = data.answer?.substring(0, 100) || 'No answer';
            console.log(`Answer Preview:  ${answerPreview}...`);
            
        } catch (error) {
            console.log(`❌ Error testing question ${test.id}: ${error.message}`);
        }
    }
    
    // Summary
    console.log("\n" + "=" * 80);
    console.log("📊 SUMMARY RESULTS");
    console.log("=" * 80);
    console.log(`Total Tests:        ${totalTests}`);
    console.log(`Intent Accuracy:    ${intentMatches}/${totalTests} (${Math.round(intentMatches/totalTests*100)}%)`);
    console.log(`Kind Accuracy:      ${kindMatches}/${totalTests} (${Math.round(kindMatches/totalTests*100)}%)`);
    console.log(`Perfect URL Match:  ${urlMatches}/${totalTests} (${Math.round(urlMatches/totalTests*100)}%)`);
    console.log(`Partial URL Match:  ${partialUrlMatches}/${totalTests} (${Math.round(partialUrlMatches/totalTests*100)}%)`);
    
    // Business Owner vs Current System
    console.log("\n🎯 BUSINESS OWNER vs CURRENT SYSTEM");
    console.log("-".repeat(50));
    console.log("Business Owner Specs: 100% accuracy across all metrics");
    console.log("Current System:       See results above");
    console.log("\n💡 This shows the gap between desired behavior and current implementation");
}

function getActualKind(structured) {
    if (structured?.events?.length > 0) return 'event';
    if (structured?.products?.length > 0) return 'product';
    if (structured?.articles?.length > 0) return 'article';
    if (structured?.services?.length > 0) return 'service';
    if (structured?.landing?.length > 0) return 'landing';
    return 'undefined';
}

function getActualUrls(structured) {
    const urls = [];
    
    if (structured?.events?.length > 0) {
        structured.events.forEach(event => {
            if (event.page_url) urls.push(event.page_url);
            if (event.url) urls.push(event.url);
        });
    }
    
    if (structured?.products?.length > 0) {
        structured.products.forEach(product => {
            if (product.page_url) urls.push(product.page_url);
            if (product.url) urls.push(product.url);
        });
    }
    
    if (structured?.articles?.length > 0) {
        structured.articles.forEach(article => {
            if (article.page_url) urls.push(article.page_url);
        });
    }
    
    if (structured?.services?.length > 0) {
        structured.services.forEach(service => {
            if (service.page_url) urls.push(service.page_url);
            if (service.url) urls.push(service.url);
        });
    }
    
    if (structured?.landing?.length > 0) {
        structured.landing.forEach(landing => {
            if (landing.page_url) urls.push(landing.page_url);
            if (landing.url) urls.push(landing.url);
        });
    }
    
    return [...new Set(urls)]; // Remove duplicates
}

function checkUrlMatches(actualUrls, expectedUrls) {
    if (actualUrls.length === 0) return { exact: false, partial: false };
    
    // Check for exact match
    const exactMatch = expectedUrls.every(expected => 
        actualUrls.some(actual => actual.includes(expected.split('/').pop()) || expected.includes(actual.split('/').pop()))
    );
    
    if (exactMatch) return { exact: true, partial: false };
    
    // Check for partial match
    const partialMatch = expectedUrls.some(expected => 
        actualUrls.some(actual => actual.includes(expected.split('/').pop()) || expected.includes(actual.split('/').pop()))
    );
    
    return { exact: false, partial: partialMatch };
}

// Run the test
testCurrentSystem().catch(console.error);

