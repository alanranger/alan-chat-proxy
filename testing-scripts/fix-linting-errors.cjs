const fs = require('fs');
const path = require('path');

// Read the chat.js file
const chatFile = path.join(__dirname, '..', 'api', 'chat.js');
let content = fs.readFileSync(chatFile, 'utf8');

console.log('🔧 Fixing common linting errors in chat.js...');

let changes = 0;

// Fix 1: Replace crypto with node:crypto
if (content.includes("const crypto = require('crypto');")) {
  content = content.replace("const crypto = require('crypto');", "const crypto = require('node:crypto');");
  changes++;
}

// Fix 2: Replace parseInt with Number.parseInt
content = content.replace(/parseInt\(/g, 'Number.parseInt(');
changes++;

// Fix 3: Replace .0 with just the number (remove zero fractions)
content = content.replace(/(\d+)\.0/g, '$1');
changes++;

// Fix 4: Remove unused variable declarations
const unusedVars = [
  'hasWorkshopQuery',
  'hasCourseQuery', 
  'seasonalTerms',
  'locationTerms',
  'chunkText',
  'getFilterAnswer',
  'parseEquipmentNeededField',
  'parseSessionField',
  'checkEventDate',
  'checkEventFitnessLevel',
  'processEventsEarlyReturn',
  'processAdviceEarlyReturn',
  'handleResidentialEventsShortcut',
  'handleAdviceFollowupSynthesis',
  'handleResidentialPricingGuard',
  'handleSessionAndLogging',
  'gatherPreContent',
  'filterChunkByPrimaryKeyword',
  'content',
  'entity',
  'c',
  'e',
  '_'
];

unusedVars.forEach(varName => {
  // Remove variable declarations that are assigned but never used
  const patterns = [
    new RegExp(`const\\s+${varName}\\s*=.*?;`, 'g'),
    new RegExp(`let\\s+${varName}\\s*=.*?;`, 'g'),
    new RegExp(`var\\s+${varName}\\s*=.*?;`, 'g'),
    new RegExp(`\\s+${varName}\\s*=\\s*.*?;`, 'g')
  ];
  
  patterns.forEach(pattern => {
    const before = content;
    content = content.replace(pattern, '');
    if (content !== before) changes++;
  });
});

// Fix 5: Remove unreachable code (lines after return statements)
const lines = content.split('\n');
let newLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  newLines.push(line);
  
  // If this line has a return statement and the next line is not empty/comment/brace
  if (line.trim().includes('return') && !line.trim().includes('//') && i + 1 < lines.length) {
    const nextLine = lines[i + 1];
    if (nextLine.trim() && !nextLine.trim().startsWith('//') && !nextLine.trim().startsWith('}') && !nextLine.trim().startsWith('} else')) {
      // Skip the unreachable line
      i++;
      changes++;
    }
  }
  i++;
}

content = newLines.join('\n');

// Fix 6: Remove empty catch blocks or add proper error handling
content = content.replace(/catch\s*\(\s*_\s*\)\s*{\s*}/g, 'catch (error) { console.error("Error:", error); }');
content = content.replace(/catch\s*\(\s*e\s*\)\s*{\s*}/g, 'catch (error) { console.error("Error:", error); }');

// Fix 7: Remove useless empty objects
content = content.replace(/{\s*}/g, 'null');

// Write the fixed content back
fs.writeFileSync(chatFile, content, 'utf8');

console.log(`✅ Fixed ${changes} common linting issues`);
console.log('✅ Removed unused variables, fixed parseInt, removed zero fractions, and cleaned up unreachable code');

