# Regression Analysis Log

This file tracks all regression analyses performed during refactoring and development.

## 📊 **BASELINE ESTABLISHED (2025-10-22)**

**Baseline Test**: `results/quality-benchmark-before-2025-10-22T17-04-41-287Z.json`
- **Average Score**: 69/100
- **Passed Tests**: 19/28 (68%)
- **Failed Tests**: 9/28 (32%)

---

## 🔍 **REGRESSION ANALYSIS #1 (2025-10-22 17:26)**

**Test File**: `results/quality-benchmark-before-2025-10-22T17-26-44-940Z.json`
**Changes Made**: Refactored `tryRagFirst` function - extracted helper functions for text cleaning, formatting, searching, scoring, and answer generation

### **RESULTS**
- **Average Score**: 69/100 ✅ (maintained)
- **Passed Tests**: 18/28 (64%) ❌ **REGRESSION**
- **Failed Tests**: 10/28 (36%) ❌ **REGRESSION**

### **DETAILED ANALYSIS**

#### 📉 **REGRESSIONS (Passed → Failed)**
- ❌ **"why are my images always grainy and noisy"**: 74→68 (-6 points)

#### 📈 **IMPROVEMENTS (Failed → Passed)**
- None

#### 📊 **SIGNIFICANT CHANGES (≥5 points)**
- None

### **SUMMARY**
- **Regressions**: 1
- **Improvements**: 0  
- **Net Change**: -1 test (19→18 passed)

### **CONCLUSION**
The refactoring successfully reduced complexity but introduced 1 functional regression. The query "why are my images always grainy and noisy" dropped from 74/100 (passing) to 68/100 (failing), representing a 6-point quality decrease.

**Root Cause**: Unknown - could be due to `tryRagFirst` refactoring or cumulative linter fixes. Need to investigate how technical troubleshooting queries are handled in the refactored code.

---

## 🔍 **REGRESSION ANALYSIS #2 (2025-10-22 18:04)**

**Test File**: `results/quality-benchmark-before-2025-10-22T18-04-01-073Z.json`
**Changes Made**: Removed unused functions - `handleServicePatterns`, `handleCurrentPatterns`, `handleSpecificCoursePatterns`, `handleWorkshopClarificationPatterns`, `checkShortWorkshopPatterns`, `checkOneDayWorkshopPatterns`, `checkMultiDayWorkshopPatterns`

### **RESULTS**
- **Average Score**: 69/100 ✅ (maintained)
- **Passed Tests**: 18/28 (64%) ❌ **SAME REGRESSION**
- **Failed Tests**: 10/28 (36%) ❌ **SAME REGRESSION**

### **DETAILED ANALYSIS**

#### 📉 **REGRESSIONS (Passed → Failed)**
- ❌ **"why are my images always grainy and noisy"**: 74→68 (-6 points) **SAME REGRESSION**

#### 📈 **IMPROVEMENTS (Failed → Passed)**
- None

#### 📊 **SIGNIFICANT CHANGES (≥5 points)**
- None

### **SUMMARY**
- **Regressions**: 1 (same as before)
- **Improvements**: 0  
- **Net Change**: -1 test (19→18 passed)

### **CONCLUSION**
The removal of unused functions did not affect the regression. The query "why are my images always grainy and noisy" still shows the same 6-point quality decrease (74→68). This confirms the regression is not related to the unused function cleanup.

**Current Status**: 
- **Linter Errors**: 105 (down from 109) ✅ **Progress made**
- **Regression**: Still present - needs investigation of `tryRagFirst` refactoring impact

---

## 📋 **ANALYSIS PROTOCOL**

For every test run, perform this analysis:

```bash
# Run comprehensive regression analysis
node -e "
const fs = require('fs');
const baseline = JSON.parse(fs.readFileSync('results/quality-benchmark-before-2025-10-22T17-04-41-287Z.json', 'utf8'));
const current = JSON.parse(fs.readFileSync('results/quality-benchmark-before-2025-10-22T17-26-44-940Z.json', 'utf8'));

console.log('🔍 COMPREHENSIVE REGRESSION ANALYSIS');
console.log('====================================');
console.log(\`Baseline: \${baseline.passedTests}/\${baseline.totalTests} passed (\${baseline.averageScore}/100)\`);
console.log(\`Current:  \${current.passedTests}/\${current.totalTests} passed (\${current.averageScore}/100)\`);
console.log('');

const regressions = [];
const improvements = [];
const unchanged = [];

baseline.results.forEach((baselineResult, index) => {
  const currentResult = current.results[index];
  if (!currentResult) return;
  
  const baselinePassed = baselineResult.quality.overall >= 70;
  const currentPassed = currentResult.quality.overall >= 70;
  const scoreDiff = currentResult.quality.overall - baselineResult.quality.overall;
  
  if (baselinePassed && !currentPassed) {
    regressions.push({query: baselineResult.query, baseline: baselineResult.quality.overall, current: currentResult.quality.overall, diff: scoreDiff});
  } else if (!baselinePassed && currentPassed) {
    improvements.push({query: baselineResult.query, baseline: baselineResult.quality.overall, current: currentResult.quality.overall, diff: scoreDiff});
  } else if (Math.abs(scoreDiff) >= 5) {
    unchanged.push({query: baselineResult.query, baseline: baselineResult.quality.overall, current: currentResult.quality.overall, diff: scoreDiff});
  }
});

console.log('📉 REGRESSIONS (Passed → Failed):');
regressions.forEach(r => console.log(\`❌ \"\${r.query}\" \${r.baseline}→\${r.current} (\${r.diff})\`));

console.log('📈 IMPROVEMENTS (Failed → Passed):');
improvements.forEach(i => console.log(\`✅ \"\${i.query}\" \${i.baseline}→\${i.current} (+\${i.diff})\`));

console.log('📊 SIGNIFICANT CHANGES (≥5 points):');
unchanged.forEach(u => console.log(\`🔄 \"\${u.query}\" \${u.baseline}→\${u.current} (\${u.diff > 0 ? '+' : ''}\${u.diff})\`));

console.log(\`\\n📋 SUMMARY: \${regressions.length} regressions, \${improvements.length} improvements, \${unchanged.length} significant changes\`);
"
```

---

## 📝 **NOTES**

- **Pass Threshold**: 70/100
- **Significant Change Threshold**: ±5 points
- **Baseline File**: Always use `results/quality-benchmark-before-2025-10-22T17-04-41-287Z.json`
- **Current File**: Use most recent test result file
- **Documentation**: Record every analysis with timestamp and changes made


