# Complexity Validation Checklist

**CRITICAL**: Before committing ANY code changes to `chat.js`, follow this checklist:

## Pre-Commit Validation Steps

### 1. **Check Complexity Before Editing**
```bash
# Run ESLint to check current complexity
npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact 2>&1 | findstr /C:"complexity"
```

### 2. **After Every Code Edit**
- [ ] Run complexity check: `npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact`
- [ ] Verify NO functions exceed complexity 15
- [ ] If ANY function exceeds 15, STOP and refactor BEFORE continuing

### 3. **Refactoring Strategy (MANDATORY)**
When a function exceeds complexity 15:
- [ ] Extract helper functions FIRST
- [ ] Test helper functions independently
- [ ] Refactor main function to use helpers
- [ ] Run 40Q test after EACH refactor
- [ ] Verify complexity is ≤15 before proceeding

### 4. **Code Modification Rules**
- [ ] NEVER add nested conditions without extracting to helper
- [ ] NEVER add loops inside conditionals without extracting
- [ ] ALWAYS extract complex logic to helper functions
- [ ] KEEP helper functions focused on single responsibility

### 5. **Pre-Commit Hook**
```bash
# Always run before git commit
npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact 2>&1 | findstr /C:"complexity"
```

### 6. **If Complexity Violations Found**
- [ ] STOP ALL other work
- [ ] Refactor violating functions immediately
- [ ] Run 40Q test to verify no regressions
- [ ] Only proceed after ALL violations resolved

## Red Flags (Stop Immediately If You See These)

- Adding nested if/else statements
- Adding loops inside conditionals
- Adding multiple return statements with complex conditions
- Modifying functions already at complexity 14-15
- Adding new features without checking existing complexity

## Helper Function Extraction Template

When extracting helpers:
1. Create helper function with SINGLE responsibility
2. Keep helper complexity ≤8 (ideal) or ≤12 (acceptable)
3. Test helper function independently
4. Refactor main function to call helper
5. Verify main function complexity ≤15

## Emergency Complexity Fix Protocol

If you accidentally create complexity >15:
1. **STOP** what you're doing
2. Run complexity check to identify violations
3. Extract helper functions immediately
4. Test with 40Q test
5. Fix ALL violations before continuing

## Validation Commands

```bash
# Check all complexity violations
npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact 2>&1 | findstr /C:"complexity"

# Check specific file
npx eslint api/chat.js --format=compact | findstr /C:"complexity"

# Run 40Q test after refactoring
node testing-scripts/test-40q-only.cjs
```

## Remember

- **Complexity limit is 15 - NOT negotiable**
- **Every edit must maintain or reduce complexity**
- **Extract helpers BEFORE modifying complex functions**
- **Test after EVERY refactor**
- **Never commit with complexity violations**

