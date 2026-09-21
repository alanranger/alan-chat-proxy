import fs from 'fs';

const reg = 'public/regression-comparison.html';
let h = fs.readFileSync(reg, 'utf8');
h = h.replace(
  'value="https://igzvwbvgvmzvvzoclufx.supabase.co"',
  'value="" placeholder="https://YOUR_PROJECT.supabase.co"'
);
fs.writeFileSync(reg, h);
console.log('regression ok', h.includes('igzvwbvgvmzvvzoclufx'));

const inter = 'public/interactive-testing.html';
let ih = fs.readFileSync(inter, 'utf8');
ih = ih.replace(/placeholder="eyJhbGci\.\.\."/g, 'placeholder="paste publishable key if needed"');
fs.writeFileSync(inter, ih);
console.log('interactive ok', /eyJhbGci/.test(ih));
