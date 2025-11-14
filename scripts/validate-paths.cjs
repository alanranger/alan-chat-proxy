#!/usr/bin/env node
const fs = require('fs');

const paths = [
  'G:\\Dropbox\\alan ranger photography\\Website Code\\alan-shared-resources\\csv processed\\02-products-cleaned.xlsx',
  'G:\\Dropbox\\alan ranger photography\\Website Code\\alan-shared-resources\\csv processed\\03-combined-product-reviews.csv',
  'G:\\Dropbox\\alan ranger photography\\Website Code\\alan-shared-resources\\csv processed\\03a-trustpilot-matched.csv',
  'G:\\Dropbox\\alan ranger photography\\Website Code\\alan-shared-resources\\csv processed\\03b-google-matched.csv',
  'G:\\Dropbox\\alan ranger photography\\Website Code\\alan-shared-resources\\csv processed\\04-product-schema-with-ratings.csv',
  'G:\\Dropbox\\alan ranger photography\\Website Code\\alan-shared-resources\\csv processed\\05-event-product-mappings-latest.csv'
];

console.log('Validating absolute paths...\n');
let allValid = true;

paths.forEach(p => {
  const exists = fs.existsSync(p);
  const name = p.split('\\').pop();
  console.log(exists ? '✓' : '✗', name);
  if (!exists) allValid = false;
});

console.log('\n' + (allValid ? '✅ All paths are valid!' : '❌ Some paths are missing'));

