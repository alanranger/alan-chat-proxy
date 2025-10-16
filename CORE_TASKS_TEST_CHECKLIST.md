# Core Tasks Test Checklist

## ✅ Task 1: Multi-day Residential Workshop Tiles

### Test Queries:
1. **"How much is a residential photography workshop and does it include B&B?"**
   - [ ] Should show event tiles (not clarification)
   - [ ] Event tiles should show date ranges (e.g., "Jan 15 – Jan 17")
   - [ ] Event tiles should show "🏠 Residential" indicator
   - [ ] Event tiles should show pricing (💰 £XXX)
   - [ ] Event tiles should show participants count if available
   - [ ] Event tiles should show experience level if available

2. **"residential workshop pricing"**
   - [ ] Should show residential workshop events
   - [ ] Should display proper multi-day formatting
   - [ ] Should show residential indicators

### Expected Improvements:
- Multi-day events are properly identified and displayed
- Residential workshops show special indicators
- Pricing information is displayed
- Additional metadata (participants, experience level) is shown

---

## ✅ Task 2: Tripod Article Tiles with Title/URL Fallbacks

### Test Queries:
1. **"What tripod do you recommend?"**
   - [ ] Should show article tiles (not clarification)
   - [ ] Article titles should be meaningful (not "Photography Guide" or "Alan Ranger Photography")
   - [ ] Article URLs should be valid and clickable
   - [ ] Article cards should show categories/tags if available
   - [ ] Article cards should show publication dates

2. **"tripod recommendations"**
   - [ ] Should show relevant tripod articles
   - [ ] All articles should have proper titles and URLs
   - [ ] No broken or generic titles

### Expected Improvements:
- Article titles are intelligently extracted from URLs when missing
- URLs are properly formatted and absolute
- Fallback logic handles missing data gracefully
- No more generic "Photography Guide" titles

---

## ✅ Task 3: Evidence-Based Clarification Options

### Test Queries:
1. **"photography equipment"**
   - [ ] Should show clarification options (not direct answer)
   - [ ] Options should be based on actual content found
   - [ ] Options should be relevant to photography equipment
   - [ ] Should not show generic hardcoded options

2. **"photography events"**
   - [ ] Should show clarification options
   - [ ] Options should be based on actual event data
   - [ ] Options should reflect real event types/categories

3. **"photography training"**
   - [ ] Should show clarification options
   - [ ] Options should be based on actual training content

### Expected Improvements:
- Clarification options are sourced from actual data
- Options reflect real content categories and types
- No more generic hardcoded clarification options
- More relevant and specific clarification choices

---

## 🧪 Manual Testing Steps:

1. **Open chat.html in browser**
2. **Test each query above**
3. **Verify the expected behaviors**
4. **Check browser console for any errors**
5. **Test edge cases with missing data**

## 🐛 Common Issues to Watch For:

- **Task 1**: Events not showing as multi-day, missing residential indicators
- **Task 2**: Generic article titles, broken URLs, missing fallbacks
- **Task 3**: Generic clarification options, no evidence-based options

## 📊 Success Criteria:

- [ ] All test queries return expected response types
- [ ] Multi-day events show proper indicators and pricing
- [ ] Article tiles have meaningful titles and valid URLs
- [ ] Clarification options are evidence-based and relevant
- [ ] No console errors or broken functionality
