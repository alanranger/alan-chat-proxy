# 🚨 CRITICAL DEBUGGING PROTOCOL

## ⚠️ MANDATORY PROCESS - NO EXCEPTIONS

### **STEP 1: LISTEN CAREFULLY**
- Read user feedback word-for-word
- Identify SPECIFIC issues (timestamps, exact error messages, specific behaviors)
- DO NOT make assumptions or generalizations

### **STEP 2: TEST LIVE ENVIRONMENT FIRST**
- ALWAYS test the actual live URL the user is using
- NEVER assume local testing = live environment working
- Use PowerShell/curl to verify live API responses

### **STEP 3: TRACE DATA FLOW**
- Map the complete path: User Input → API → Database → Response → Display
- Identify WHERE the data flow breaks
- DO NOT guess - trace step by step

### **STEP 4: ONE TARGETED FIX**
- Make ONLY ONE change at a time
- Address the SPECIFIC root cause identified
- DO NOT add complexity or multiple changes

### **STEP 5: VERIFY FIX WORKS**
- Test the fix in LIVE environment
- Confirm the specific issue is resolved
- DO NOT claim success until verified

### **STEP 6: REPORT RESULTS**
- Only report success AFTER verification
- Include specific test results
- Acknowledge if fix didn't work

## 🚫 FORBIDDEN BEHAVIORS

- ❌ "It should be working" without testing
- ❌ Multiple changes without testing each
- ❌ Claiming fixes before verification
- ❌ Ignoring user's specific feedback
- ❌ Testing locally and assuming live works
- ❌ Guessing instead of systematic debugging

## ✅ REQUIRED BEHAVIORS

- ✅ Test live environment first
- ✅ Listen to specific user feedback
- ✅ Trace data flow systematically
- ✅ One fix at a time
- ✅ Verify each fix works
- ✅ Only claim success after verification

## 📋 DEBUGGING CHECKLIST

Before making ANY changes:
- [ ] What exactly is the user reporting?
- [ ] Have I tested the live environment?
- [ ] Do I understand the complete data flow?
- [ ] Am I making only ONE targeted fix?
- [ ] How will I verify this fix works?

## 🎯 SUCCESS CRITERIA

A fix is only successful when:
1. User's specific issue is resolved
2. Live environment works correctly
3. No regressions introduced
4. User confirms it works

---
**Created**: 2025-10-26
**Purpose**: Prevent recurring debugging mistakes
**Status**: MANDATORY - Follow this protocol for ALL debugging tasks
