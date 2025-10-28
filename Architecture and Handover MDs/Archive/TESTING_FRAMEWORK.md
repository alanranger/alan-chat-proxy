# Testing Framework for Chat API

This testing framework provides comprehensive regression testing capabilities to ensure no regressions occur during refactoring of the complex `api/chat.js` file.

## 🎯 Purpose

The main `api/chat.js` file previously had extremely high cognitive complexity (up to 400 in some functions), making it difficult to debug and maintain. After a comprehensive 5-day refactoring effort (2025-10-13 to 2025-10-18), all functions now have complexity ≤ 15, dramatically improving maintainability.

This testing framework provides:

- **Regression Protection**: Catch regressions before they reach production
- **Baseline Comparison**: Compare current behavior against known good states
- **Deployment Safety**: Automated checks before any deployment
- **Comprehensive Coverage**: Test all critical user journeys
- **Complexity Enforcement**: Ensure no functions exceed complexity 15

## 📁 Test Files

### Core Test Scripts

1. **`regression-test-suite.js`** - Comprehensive test suite covering all critical user journeys
2. **`capture-baseline.js`** - Captures current system behavior as a baseline
3. **`compare-against-baseline.js`** - Compares current behavior against captured baseline
4. **`deployment-safety-check.js`** - Runs safety checks before deployment

### Test Categories

#### Critical Event Queries
- Lightroom course queries
- Photography workshop queries
- Residential pricing queries
- Beginner course queries

#### Equipment Advice Queries
- Tripod recommendations
- Camera advice
- Equipment guidance

#### Clarification Queries
- Ambiguous requests
- Vague equipment queries
- Nonsensical inputs

#### Edge Cases
- Empty queries
- Invalid inputs
- Error conditions

## 🚀 Usage

### Quick Start

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:regression    # Comprehensive regression tests
npm run test:safety        # Deployment safety checks
npm run test:baseline      # Capture current baseline
npm run test:compare       # Compare against baseline

# CRITICAL: Check complexity before any changes
npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact
```

### Workflow for Refactoring

**CRITICAL: ENDPOINT VERIFICATION PROTOCOL**

1. **Before Starting ANY Changes**:
   ```bash
   # STEP 1: Verify local server setup
   $env:SUPABASE_URL="https://igzvwbvgvmzvvzoclufx.supabase.co"; $env:SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY"; node local-dev-server.js
   
   # STEP 2: Verify chat.html uses LOCAL endpoint
   grep "CHAT_ENDPOINT" public/chat.html
   # MUST show: const CHAT_ENDPOINT = '/api/chat';
   # NOT: const CHAT_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';
   
   # STEP 3: Test local endpoint works
   curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"query":"test"}'
   
   # STEP 4: Check current complexity
   npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact
   
   # STEP 5: Capture baseline behavior (LOCAL)
   node quality-benchmark-test.cjs
   ```
   This ensures local setup is correct and captures LOCAL behavior.

2. **During Refactoring**:
   ```bash
   # After each change, check complexity
   npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact
   
   # CRITICAL: Test LOCAL endpoint after each change
   node quality-benchmark-test.cjs
   
   # Compare against LOCAL baseline
   npm run test:compare baseline-YYYY-MM-DD.json
   ```
   This ensures complexity remains ≤ 15 and detects regressions in LOCAL code.

3. **Before Deployment**:
   ```bash
   # Final complexity check
   npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact
   
   # Test LOCAL endpoint one final time
   node quality-benchmark-test.cjs
   
   # Run all safety checks
   npm run test:all
   ```
   This runs all safety checks and ensures no complexity violations.

### 🚨 Complexity Enforcement Protocol

**MANDATORY STEPS BEFORE ANY COMMIT:**
1. **Complexity Check**: `npx eslint api/chat.js --rule='complexity: [2, 15]'`
2. **Verify Zero Violations**: No functions should exceed complexity 15
3. **If Violations Found**: STOP and refactor immediately
4. **Regression Tests**: Run full test suite
5. **Only Then Commit**: All checks must pass

**REFACTORING TECHNIQUES:**
- Extract helper functions for complex logic
- Use early returns to reduce nesting
- Break down complex conditionals
- Separate concerns into focused functions

### Manual Testing

```bash
# Test specific query
node -e "
import fetch from 'node-fetch';
const response = await fetch('https://alan-chat-proxy.vercel.app/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'When is the next Lightroom course in Coventry?' })
});
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
"
```

## 📊 Test Results

### Success Criteria

- **API Health**: All endpoints responding correctly
- **Response Structure**: Valid JSON with required fields
- **Performance**: Response times under 10 seconds
- **Functionality**: Critical queries returning expected results
- **Error Handling**: Graceful handling of invalid inputs

### Failure Conditions

- **Regressions**: Any degradation in functionality
- **Performance**: Response times exceeding thresholds
- **Structure**: Invalid response formats
- **Errors**: Unhandled exceptions or crashes

## 🛡️ Regression Protection

### Baseline Comparison

The framework captures detailed baselines including:
- Response types and confidence levels
- Event and article counts
- Clarification behavior
- Error handling patterns

### Automated Alerts

- **Immediate Failure**: Tests exit with error code 1 if regressions detected
- **Detailed Logging**: Comprehensive logs of what changed
- **Report Generation**: JSON reports for analysis

### Deployment Safety

- **Pre-deployment Checks**: All tests must pass before deployment
- **Performance Monitoring**: Response time validation
- **Health Checks**: API availability and structure validation

## 🔧 Configuration

### **ESTABLISHED BASELINE (2025-10-22)**

**Baseline Test File**: `results/quality-benchmark-before-2025-10-22T17-04-41-287Z.json`

**Baseline Metrics**:
- **Average Quality Score**: 69/100
- **Passed Tests**: 18/28 (64.3%)
- **Failed Tests**: 10/28 (35.7%)
- **Total Tests**: 28

**Critical Note**: This baseline was established AFTER fixing the critical testing methodology failure where tests were incorrectly calling the deployed API instead of local code. This baseline represents the true local system performance before refactoring.

**Updated**: 2025-10-22 19:18 - Confirmed working baseline with correct API keys and local server

### **REGRESSION ANALYSIS PROTOCOL**

**MANDATORY**: After every test run, perform comprehensive regression analysis:

```bash
# Create comparison script
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

**Documentation Requirements**:
- Record every regression analysis in `notes/store/REGRESSION_ANALYSIS.md`
- Include timestamp, changes made, and full comparison results
- Track patterns across multiple test runs

### Test Endpoints

**CRITICAL: LOCAL TESTING REQUIREMENTS**

For local development and refactoring, ALWAYS use local endpoints:

```javascript
// LOCAL TESTING (MANDATORY for refactoring)
const API_ENDPOINT = 'http://localhost:3000/api/chat';
const FRONTEND_URL = 'http://localhost:3000/chat.html';

// PRODUCTION TESTING (only for deployment validation)
const API_ENDPOINT = 'https://alan-chat-proxy.vercel.app/api/chat';
const FRONTEND_URL = 'https://alan-chat-proxy.vercel.app/chat.html';
```

**MANDATORY VERIFICATION STEPS:**
1. **Verify chat.html endpoint**: Check `public/chat.html` line 759 uses `/api/chat` (not deployed URL)
2. **Verify local server**: Confirm `local-dev-server.js` imports `./api/chat.js`
3. **Test local endpoint**: Run `curl http://localhost:3000/api/chat` to confirm local API
4. **NEVER assume**: Always verify what endpoint tests are actually calling

### Test Thresholds

```javascript
const EXPECTED_CONFIDENCE_TOLERANCE = 0.2;  // 20% tolerance for confidence
const MAX_RESPONSE_TIME = 10000;            // 10 seconds max response time
const MIN_EVENTS_FOR_HIGH_CONFIDENCE = 1;   // At least 1 event for high confidence
```

## 📈 Monitoring

### Test Reports

All test runs generate detailed JSON reports:
- `regression-test-results-YYYY-MM-DD.json`
- `baseline-YYYY-MM-DD.json`
- `comparison-YYYY-MM-DD.json`
- `deployment-safety-YYYY-MM-DD.json`

### Metrics Tracked

- **Success Rate**: Percentage of tests passing
- **Response Times**: API performance metrics
- **Confidence Levels**: Query confidence scores
- **Event Counts**: Number of events returned
- **Article Counts**: Number of articles returned

## 🚨 Troubleshooting

### Common Issues

1. **JSON Parsing Errors**: Usually indicates response structure changes
2. **Timeout Errors**: API performance issues
3. **Confidence Mismatches**: Logic changes in confidence calculation
4. **Missing Events**: Database or query logic issues

### Debug Commands

```bash
# Check API health
curl -X POST "https://alan-chat-proxy.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Test specific query
curl -X POST "https://alan-chat-proxy.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "When is the next Lightroom course in Coventry?"}'
```

## 🔄 Integration with CI/CD

### GitHub Actions Example

```yaml
name: Regression Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '22'
      - run: npm install
      - run: npm run test:all
```

### Pre-commit Hooks

```bash
# Install pre-commit hook
echo "npm run test:safety" > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 📝 Best Practices

1. **Always run tests before deployment**
2. **Capture baselines before major changes**
3. **Compare against baselines during refactoring**
4. **Monitor test reports for trends**
5. **Fix regressions immediately**
6. **Keep test cases up to date**

## 🎯 Future Enhancements

- **Visual Regression Testing**: Screenshot comparisons
- **Load Testing**: Performance under load
- **A/B Testing**: Compare different implementations
- **Automated Rollback**: Automatic rollback on regression detection
- **Real-time Monitoring**: Continuous health monitoring
