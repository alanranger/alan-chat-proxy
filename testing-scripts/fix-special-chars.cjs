const fs = require('fs');
const path = require('path');

// Read the chat.js file
const chatFile = path.join(__dirname, '..', 'api', 'chat.js');
let content = fs.readFileSync(chatFile, 'utf8');

console.log('🔧 Fixing special characters in chat.js...');

// Replace all instances of special characters with standard equivalents
const replacements = [
  // Replace checkmark emoji with [SUCCESS]
  [/\u2705/g, '[SUCCESS]'],
  // Replace warning emoji with [WARN]
  [/\u26A0\uFE0F/g, '[WARN]'],
  // Replace other warning emoji with [WARN]
  [/\u26A0/g, '[WARN]'],
  // Replace other special characters
  [/\uFE0F/g, ''],
  // Replace any remaining irregular whitespace
  [/[\u00A0\u2000-\u200F\u2028-\u202F\u205F-\u206F\u3000]/g, ' '],
];

let changes = 0;
replacements.forEach(([pattern, replacement]) => {
  const before = content;
  content = content.replace(pattern, replacement);
  if (content !== before) {
    changes++;
  }
});

// Write the fixed content back
fs.writeFileSync(chatFile, content, 'utf8');

console.log(`✅ Fixed ${changes} special character issues`);
console.log('✅ All irregular whitespace and emoji characters replaced with standard text');

