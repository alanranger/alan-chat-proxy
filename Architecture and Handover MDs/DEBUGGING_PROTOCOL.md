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

## 🚨 CRITICAL OPERATIONAL RULES

### Git Commands - ALWAYS USE MCP:
- **NEVER** use terminal `git` commands directly
- **ALWAYS** use MCP GitKraken tools: `mcp_GitKraken_git_add_or_commit`, `mcp_GitKraken_git_push`, etc.
- **NEVER** attempt `git commit --no-verify` or bypass Husky linting
- **ALWAYS** let MCP handle authentication and push protection

### Local Server Management:
- **NEVER** start the local server yourself
- **ALWAYS** ask the user to start the local server
- **NEVER** hardcode environment variables in deployed code
- **ALWAYS** rely on user-provided environment variables

### Why These Rules Matter:
- Terminal git commands often hang or fail with authentication issues
- Starting the server yourself leads to hardcoded API keys in deployed code
- These mistakes cause deployment failures and wasted debugging time
- User has explicitly requested these rules multiple times

---
**Created**: 2025-10-26
**Purpose**: Prevent recurring debugging mistakes
**Status**: MANDATORY - Follow this protocol for ALL debugging tasks

## Update Log
- 2026-01-16 19:59: Updated with latest ingest image fallback (prefer content over logo), bulk ingest UI watchdog timeout, search tile description expansion and image fallback/proxy, and restore point `restore-20260116-1948`.
