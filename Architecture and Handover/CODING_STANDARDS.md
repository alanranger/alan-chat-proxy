# Coding Standards and Quality Guidelines
_Last updated: 2025-10-18_

## 🚨 CRITICAL: Cognitive Complexity Rules

### **MANDATORY COMPLEXITY LIMITS**
- **Maximum cognitive complexity per function: 15**
- **Maximum statements per function: 20**
- **Maximum parameters per function: 4**

### **ENFORCEMENT**
- **ESLint rules MUST be configured to enforce these limits**
- **All code changes MUST pass complexity checks before commit**
- **NO EXCEPTIONS** - these limits are non-negotiable

### **Why These Limits Matter**
- **Maintainability**: Functions with complexity > 15 are difficult to understand and debug
- **Testing**: Complex functions are harder to test comprehensively
- **Debugging**: High complexity leads to bugs and makes troubleshooting difficult
- **Team Productivity**: Simple functions are easier for any developer to work with

## 📋 Pre-commit Checklist

### **Before ANY code change:**
1. **Run complexity analysis**: `npx eslint api/chat.js --rule='complexity: [2, 15]'`
2. **Verify no functions exceed complexity 15**
3. **Run regression tests**: `npm run test:baseline && npm run test:compare`
4. **Ensure all tests pass**
5. **Only then commit and deploy**

### **If complexity > 15 is detected:**
1. **STOP** - do not commit
2. **Refactor immediately** using helper function extraction
3. **Re-run complexity analysis**
4. **Continue only when complexity ≤ 15**

## 🔧 Refactoring Guidelines

### **When Complexity Exceeds 15:**
1. **Extract helper functions** for specific logic blocks
2. **Use early returns** to reduce nesting
3. **Break down complex conditionals** into separate functions
4. **Separate concerns** - one function, one responsibility

### **Helper Function Patterns:**
```javascript
// ❌ BAD: High complexity function
function complexFunction(data) {
  if (condition1) {
    if (condition2) {
      if (condition3) {
        // complex logic here
      }
    }
  }
  // more complex logic...
}

// ✅ GOOD: Extracted helper functions
function complexFunction(data) {
  if (!isValidData(data)) return false;
  
  const processedData = processData(data);
  const result = calculateResult(processedData);
  
  return formatResult(result);
}

function isValidData(data) {
  return condition1 && condition2 && condition3;
}

function processData(data) {
  // specific processing logic
}

function calculateResult(data) {
  // specific calculation logic
}

function formatResult(result) {
  // specific formatting logic
}
```

## 🧪 Testing Requirements

### **Mandatory Testing Protocol:**
1. **Baseline capture**: `npm run test:baseline`
2. **Make changes**
3. **Regression testing**: `npm run test:compare baseline-YYYY-MM-DD.json`
4. **Verify no regressions**
5. **Deploy only if all tests pass**

### **Test Coverage Requirements:**
- **All critical user journeys** must be tested
- **Edge cases** must be covered
- **Error conditions** must be handled
- **Performance** must be maintained

## 📊 Quality Metrics

### **Code Quality Targets:**
- **Cognitive Complexity**: ≤ 15 per function
- **Function Length**: ≤ 20 statements
- **Parameter Count**: ≤ 4 per function
- **Test Coverage**: 100% for critical paths
- **Performance**: < 10 seconds response time

### **Monitoring:**
- **Daily complexity scans** using ESLint
- **Weekly regression test runs**
- **Monthly code quality reviews**

## 🚫 Anti-Patterns to Avoid

### **NEVER DO:**
- ❌ Create functions with complexity > 15
- ❌ Write functions with > 20 statements
- ❌ Use > 4 parameters in a function
- ❌ Commit without running tests
- ❌ Deploy with failing tests
- ❌ Ignore complexity warnings

### **COMMON MISTAKES:**
- ❌ Nested conditionals without extraction
- ❌ Long switch statements without helper functions
- ❌ Complex loops without extraction
- ❌ Multiple responsibilities in one function
- ❌ Deep nesting without early returns

## ✅ Best Practices

### **DO:**
- ✅ Extract helper functions for complex logic
- ✅ Use early returns to reduce nesting
- ✅ Keep functions focused on single responsibility
- ✅ Write comprehensive tests
- ✅ Run complexity analysis before commits
- ✅ Document complex business logic

### **Function Design:**
- ✅ **Single Responsibility**: One function, one job
- ✅ **Clear Naming**: Function names should describe what they do
- ✅ **Minimal Parameters**: Use objects for multiple parameters
- ✅ **Early Returns**: Reduce nesting with early exits
- ✅ **Helper Functions**: Extract complex logic into focused helpers

## 🔄 Continuous Improvement

### **Regular Reviews:**
- **Weekly**: Review new functions for complexity
- **Monthly**: Analyze complexity trends
- **Quarterly**: Update standards based on learnings

### **Tools and Automation:**
- **ESLint**: Automated complexity checking
- **Pre-commit hooks**: Prevent commits with high complexity
- **CI/CD**: Automated testing and quality checks
- **Monitoring**: Track complexity metrics over time

## 📚 Learning Resources

### **Complexity Reduction Techniques:**
1. **Extract Method**: Break large functions into smaller ones
2. **Replace Conditional with Polymorphism**: Use strategy pattern
3. **Introduce Parameter Object**: Reduce parameter count
4. **Replace Nested Conditional with Guard Clauses**: Use early returns
5. **Extract Class**: Move related functions to dedicated classes

### **Testing Strategies:**
1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test function interactions
3. **Regression Tests**: Ensure no functionality is broken
4. **Performance Tests**: Verify response times

## 🎯 Success Criteria

### **Code Quality Goals:**
- **Zero functions** with complexity > 15
- **100% test coverage** for critical paths
- **Zero regressions** in production
- **Consistent performance** under load
- **Maintainable codebase** for future development

### **Team Productivity:**
- **Faster debugging** due to simpler functions
- **Easier onboarding** for new developers
- **Reduced bug rates** from complex logic
- **Improved code reviews** with clear, simple functions

---

## 📝 Historical Context

### **Previous Issues (2025-10-13 to 2025-10-18):**
- **37 functions** had complexity > 15 (ranging from 16 to 400)
- **5 days of refactoring** required to fix the issues
- **~400+ complexity points** eliminated through systematic refactoring
- **Zero regressions** achieved through comprehensive testing

### **Lessons Learned:**
- **Prevention is better than cure** - enforce limits from the start
- **Automated checks** prevent human error
- **Comprehensive testing** ensures quality
- **Systematic refactoring** is more effective than ad-hoc fixes

### **Current Status (2025-10-18):**
- **37 functions** successfully refactored to ≤15 complexity
- **Only 1 function** remains with complexity > 15 (main handler - intentionally left for last)
- **All tests passing** with zero regressions
- **Code quality dramatically improved**

---

**Remember: These standards exist because we spent 5 days fixing complexity issues that could have been prevented. Don't let history repeat itself.**
