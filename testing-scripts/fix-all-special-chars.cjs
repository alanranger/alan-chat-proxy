const fs = require('fs');
const path = require('path');

// Read the chat.js file
const chatFile = path.join(__dirname, '..', 'api', 'chat.js');
let content = fs.readFileSync(chatFile, 'utf8');

console.log('🔧 Fixing all special characters and emoji remnants in chat.js...');

// Replace all instances of special characters and emoji remnants
const replacements = [
  // Replace various emoji and special character combinations
  [/\u2705/g, '[SUCCESS]'],
  [/\u26A0\uFE0F?/g, '[WARN]'],
  [/\uFE0F/g, ''],
  [/\u00A0/g, ' '], // Non-breaking space
  [/\u2000-\u200F/g, ' '], // Various spaces
  [/\u2028-\u202F/g, ' '], // Line/paragraph separators
  [/\u205F-\u206F/g, ' '], // Mathematical spaces
  [/\u3000/g, ' '], // Ideographic space
  // Fix specific problematic sequences
  [/âš ï¸/g, '[WARN]'],
  [/âœ…/g, '[SUCCESS]'],
  [/âš/g, '[WARN]'],
  [/ï¸/g, ''],
  // Clean up any remaining irregular whitespace
  [/[\u00A0\u2000-\u200F\u2028-\u202F\u205F-\u206F\u3000]/g, ' '],
  // Fix double spaces that might have been created
  [/  +/g, ' '],
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
console.log('✅ All emoji remnants and irregular characters replaced with standard text');

