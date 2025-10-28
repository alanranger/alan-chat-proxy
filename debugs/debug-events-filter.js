// Debug script to test the event filtering logic
const query = "When is the next Lightroom course in Coventry?";

function extractKeywords(q) {
  const lc = (q || '').toLowerCase();
  const kws = new Set();
  const words = lc.match(/[a-z0-9]+/g) || [];
  words.forEach((w) => {
    if (w.length > 2) kws.add(w);
  });
  return Array.from(kws);
}

const keywords = extractKeywords(query);
console.log('Query:', query);
console.log('Keywords:', keywords);

// Test the filtering logic
const GENERIC_EVENT_TERMS = new Set(["workshop","workshops","course","courses","class","classes","event","events","next","when","your"]);
const significant = keywords.find(k => k && !GENERIC_EVENT_TERMS.has(String(k).toLowerCase()) && String(k).length >= 4);

console.log('Generic terms:', Array.from(GENERIC_EVENT_TERMS));
console.log('Significant keyword:', significant);

// Test the matchEvent function with sample data
const sampleEvent = {
  title: "Lightroom Classic Photo Editing Classes -Week 1 of 3 - 4-11",
  event_title: "Lightroom Classic Photo Editing Classes -Week 1 of 3 - 4-11",
  product_title: "",
  location_name: "Coventry",
  event_location: "Coventry"
};

const matchEvent = (e, term) => {
  const t = term.toLowerCase();
  const hay = `${e.title||e.event_title||''} ${e.product_title||''} ${e.location_name||e.event_location||''}`.toLowerCase();
  console.log(`Matching "${t}" against: "${hay}"`);
  return hay.includes(t);
};

if (significant) {
  const matches = matchEvent(sampleEvent, significant);
  console.log('Event matches significant keyword:', matches);
} else {
  console.log('No significant keyword found');
}
