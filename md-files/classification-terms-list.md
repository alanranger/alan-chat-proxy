# Hardcoded Classification Terms - Complete List

This document lists all the hardcoded terms that are currently going through the classification system in `api/chat.js`. These patterns were created as a legacy system when queries weren't getting responses without clarification.

## Classification Functions Overview

The classification system runs in this order:
1. Equipment requirement queries (priority check)
2. Course clarification patterns
3. Contact Alan patterns
4. Workshop query patterns
5. Private lessons patterns
6. Direct answer patterns (currently disabled)
7. Clarification patterns

## 1. Course Clarification Patterns (`checkCourseClarificationPatterns`)

- `what courses do you offer`
- `what photography courses do you have`
- `what photography courses do you offer`
- `what courses do you have`
- `what courses` (excluding camera need queries)
- `do you offer courses`
- `do you do courses`

## 2. Contact Alan Patterns (`checkContactAlanPatterns`)

- `cancellation or refund policy for courses`
- `cancellation or refund policy for workshops`
- `how do i book a course or workshop`
- `can the gift voucher be used for any workshop`
- `can the gift voucher be used for any course`
- `how do i know which course or workshop is best`
- `do you do astrophotography workshops`
- `do you get a certificate with the photography course`
- `do i get a certificate with the photography course`
- `can my.*attend your workshop`
- `can.*year old attend your workshop`
- `how do i subscribe to the free online photography course`
- `how many students per workshop`
- `how many students per class`
- `what gear or equipment do i need to bring to a workshop`
- `what equipment do i need to bring to a workshop`
- `how early should i arrive before a class`
- `how early should i arrive before a workshop`

## 3. Workshop Query Patterns (`checkWorkshopQueryPatterns`)

- `photography workshop`
- `workshop`
- `photography training`
- `photography course`
- `photography lesson` (excluding private)
- `photography class`
- `photography classes`
- `beginner photography class`
- `beginner photography classes`
- `photography classes warwickshire`
- `photography classes coventry`
- `lightroom course`
- `lightroom courses`
- `lightroom training`
- `photo editing course`
- `photo editing courses`
- `editing course`
- `editing courses`
- `photoshop course`
- `photoshop courses`
- `camera course`
- `camera courses`
- `weekend photography workshop`
- `weekend photography workshops`
- `group photography workshop`
- `group photography workshops`
- `advanced photography workshop`
- `advanced photography workshops`
- `workshop equipment`
- `workshop group`
- `workshop experience`
- `workshop booking`
- `workshop cancellation`
- `weekend.*workshop`
- `group.*workshop`
- `advanced.*workshop`
- `equipment.*provided`
- `photoshop.*course`

## 4. Private Lessons Patterns (`checkPrivateLessonsPatterns`)

- `private photography lessons`
- `private lessons`
- `1-2-1.*lessons`
- `one-to-one.*lessons`
- `rps mentoring course`
- `rps mentoring`
- `rps course`

## 5. Direct Answer Patterns (`checkDirectAnswerPatterns`)

- **DISABLED** (returns null)

## 6. Clarification Patterns (`checkClarificationPatterns`)

- `photography articles`
- `photography tips`
- `photography help`
- `photography advice`
- `photography equipment`
- `photography gear`
- `photography techniques`
- `photography tutorials`
- `what courses do you offer`
- `what courses`
- `do you offer courses`
- `do you do courses`

## 7. Equipment Requirement Queries (Priority check)

- `what camera do i need`
- `camera requirements`
- `equipment requirements`

## Summary

**Total Count**: Approximately **80+ hardcoded patterns** across 6 different classification functions.

**Status**: These patterns are currently intercepting queries and routing them to clarification responses instead of letting the RAG system handle them directly.

**Recommendation**: Test these queries without classification to see how many now work well with the new service pages in the database. Many course/workshop related queries should now be handled by the RAG system with the new landing service pages.

## Testing Notes

- Many of these patterns should now work well with the new service pages
- Course/workshop queries should find relevant content in the database
- Service-related queries should now return service tiles
- Some queries may need additional landing pages added to the CSV
