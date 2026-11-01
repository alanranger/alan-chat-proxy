# Archived scripts

- `refresh-07-product-schema-ingest.mjs` — rebuilt `csv/07-product-schema-with-review-ratings.csv` from the 04 RATINGS file.
  Retired in BAU batch 7 (P11, 1 Nov 2026): 07 is now written by the Schema Tools product schema generator
  (`generate-product-schema.py --write-07`, BAU Monthly stage D). `npm run prep:ingest` and `import-07-product-schema-now.mjs`
  no longer call it. Kept for history; do not wire it back in.
