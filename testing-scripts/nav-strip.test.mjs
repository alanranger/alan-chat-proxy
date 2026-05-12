/**
 * @file Sanity checks for Squarespace nav stripping heuristics (npm run test:nav-strip).
 */
/* global console */

import assert from 'node:assert/strict';
import {
  chunkLooksLikeCollapsedSiteNav,
  KNOWN_NAV_SIGNATURE_PHRASES,
  stripKnownSquarespaceNavNoise,
  SQUARESPACE_NAV_SIGNATURE_VERSION,
} from '../helpers/squarespace-nav.js';

const navBlob = `
  Sign In My Account/searchBack photographers near coventry
  Which Photography Courses Are Best For Me? Course Calendar
`;

assert.ok(chunkLooksLikeCollapsedSiteNav(navBlob));
assert.ok(!chunkLooksLikeCollapsedSiteNav('Golden hour woodland tips with layered foreground interest.'));

const cleaned = stripKnownSquarespaceNavNoise(navBlob.toLowerCase());
assert.ok(!cleaned.includes('searchback'));

assert.equal(SQUARESPACE_NAV_SIGNATURE_VERSION, 1);
assert.ok(KNOWN_NAV_SIGNATURE_PHRASES.length > 2);

console.log('nav-strip.test.mjs: OK');
