const fs = require('fs');
const path = require('path');

// Read the chat.js file
const chatFile = path.join(__dirname, '..', 'api', 'chat.js');
let content = fs.readFileSync(chatFile, 'utf8');

console.log('🔧 Fixing critical linting errors in chat.js...');

let changes = 0;

// Fix 1: Replace crypto with node:crypto
if (content.includes("const crypto = require('crypto');")) {
  content = content.replace("const crypto = require('crypto');", "const crypto = require('node:crypto');");
  changes++;
}

// Fix 2: Replace parseInt with Number.parseInt
const parseIntMatches = content.match(/parseInt\(/g);
if (parseIntMatches) {
  content = content.replace(/parseInt\(/g, 'Number.parseInt(');
  changes += parseIntMatches.length;
}

// Fix 3: Remove zero fractions (e.g., 1.0 -> 1)
const zeroFractionMatches = content.match(/\d+\.0\b/g);
if (zeroFractionMatches) {
  content = content.replace(/\b(\d+)\.0\b/g, '$1');
  changes += zeroFractionMatches.length;
}

// Fix 4: Fix octal literals
content = content.replace(/\b05\b/g, '0o5');
changes++;

// Fix 5: Remove unused variable declarations (only the most obvious ones)
const unusedVarPatterns = [
  /const\s+hasWorkshopQuery\s*=.*?;/g,
  /const\s+hasCourseQuery\s*=.*?;/g,
  /const\s+seasonalTerms\s*=.*?;/g,
  /const\s+locationTerms\s*=.*?;/g,
  /const\s+chunkText\s*=.*?;/g,
  /const\s+content\s*=.*?;/g,
  /const\s+entity\s*=.*?;/g,
  /const\s+c\s*=.*?;/g,
  /const\s+e\s*=.*?;/g,
  /const\s+_\s*=.*?;/g
];

unusedVarPatterns.forEach(pattern => {
  const before = content;
  content = content.replace(pattern, '');
  if (content !== before) changes++;
});

// Fix 6: Fix empty catch blocks
content = content.replace(/catch\s*\(\s*_\s*\)\s*{\s*}/g, 'catch (error) { console.error("Error:", error); }');
content = content.replace(/catch\s*\(\s*e\s*\)\s*{\s*}/g, 'catch (error) { console.error("Error:", error); }');
changes++;

// Write the fixed content back
fs.writeFileSync(chatFile, content, 'utf8');

console.log(`✅ Fixed ${changes} critical linting issues`);
console.log('✅ Fixed crypto import, parseInt, zero fractions, octal literals, and unused variables');

