# Rollback Procedure for Content-Based Refactor

## Emergency Rollback Commands

### Quick Rollback to Pattern Matching System
```bash
# Rollback to the backup tag
git checkout backup-pattern-matching-system

# Force push to revert main branch (DANGER: This will lose all changes after backup)
git push origin main --force

# Alternative: Create rollback branch
git checkout -b rollback-to-pattern-matching backup-pattern-matching-system
git push origin rollback-to-pattern-matching
```

### Safe Rollback (Recommended)
```bash
# Create rollback branch from backup
git checkout -b rollback-pattern-matching backup-pattern-matching-system

# Push rollback branch
git push origin rollback-pattern-matching

# Switch main to rollback branch
git checkout main
git reset --hard rollback-pattern-matching
git push origin main --force
```

## Backup Information

### Backup Tag Details
- **Tag Name**: `backup-pattern-matching-system`
- **Commit**: `849ed27`
- **Date**: Before content-based refactor
- **Status**: Pattern matching system with 60% failure rate but working for known patterns

### What's Included in Backup
- ✅ Working pattern matching system
- ✅ Service clarification patterns (recently added)
- ✅ All existing clarification logic
- ✅ Complete documentation of current state
- ✅ Test results showing 60% failure rate

### What Will Be Lost in Rollback
- ❌ Content-based confidence logic
- ❌ Improved clarification system
- ❌ Any fixes made during refactor
- ❌ New test results and validation

## Rollback Triggers

### When to Rollback
1. **Success rate drops below 40%** (current baseline)
2. **Critical functionality breaks** (events, advice, services)
3. **User experience degrades** significantly
4. **System becomes unstable** or unreliable

### When NOT to Rollback
1. **Minor issues** that can be fixed quickly
2. **Expected teething problems** during transition
3. **Performance issues** that don't affect core functionality
4. **User feedback** that can be addressed with tweaks

## Rollback Validation

### After Rollback, Verify:
1. **Baseline 20 questions** work correctly
2. **Known patterns** trigger clarifications
3. **Service queries** work (recently added)
4. **Events and advice** routing functions
5. **No new errors** in system logs

### Test Commands
```bash
# Test baseline questions
node test-baseline-20-questions.js

# Test service clarification
node test-service-clarification.js

# Check system health
curl -X POST http://localhost:3000/api/chat -d '{"query":"photography equipment advice"}'
```

## Recovery Plan

### If Rollback is Needed
1. **Immediate**: Execute rollback commands
2. **Within 1 hour**: Validate system functionality
3. **Within 4 hours**: Analyze what went wrong
4. **Within 24 hours**: Plan next iteration or alternative approach

### Post-Rollback Actions
1. **Document issues** encountered during refactor
2. **Analyze failure points** in content-based approach
3. **Plan incremental improvements** to pattern system
4. **Consider hybrid approach** combining both methods

## Contact Information
- **Primary**: Alan Ranger
- **Backup**: Development team
- **Emergency**: System administrator

## Last Updated
- **Date**: Before content-based refactor
- **Version**: Pattern matching system v1.2.37
- **Status**: Ready for rollback if needed
