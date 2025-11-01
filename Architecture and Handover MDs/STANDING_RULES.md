# STANDING RULES FOR AI ASSISTANT

## 🚨 **CRITICAL RULES - NEVER VIOLATE:**

### 1. **HUSKY PRE-COMMIT HOOKS**
- **NEVER bypass husky pre-commit hook without explicit permission**
- Always run `git commit` normally first
- If husky fails, ask user for permission before using `--no-verify`
- This rule was established after unauthorized bypass caused deployment issues

### 2. **SERVER RESTART PROTOCOL**
- **ALWAYS ask before running tests after code changes**
- **ALWAYS ask before running tests after server restart**
- Never assume server is running or has latest code
- User must confirm server status before testing

### 3. **CODE QUALITY STANDARDS**
- **ALWAYS run lint after code changes** to detect new issues
- **MANDATORY Complexity Limits**: Maximum cognitive complexity of 15 per function
- **Pre-Commit Validation**: ALWAYS run complexity check before committing:
  ```bash
  npx eslint api/chat.js --rule='complexity: [2, 15]' --format=compact 2>&1 | findstr /C:"complexity"
  ```
- **Complexity Violation Protocol**: If ANY function exceeds 15, STOP all work, refactor immediately, test with 40Q, then continue
- **Refactoring Strategy**: Extract helper functions BEFORE modifying complex functions - never add complexity
- **Never create complex functions** (cognitive complexity > 15) - extract helpers instead
- **Never create functions with too many statements** (> 20)
- **Refactor immediately if linting fails**
- **See**: `COMPLEXITY_VALIDATION_CHECKLIST.md` for detailed validation protocol

### 4. **TESTING PROTOCOL**
- **ALWAYS ask before running tests after code changes**
- **ALWAYS ask before running tests after server restart**
- Wait for user confirmation before executing test commands
- Never assume server state or code deployment

### 5. **DATA ACCURACY**
- **NEVER hardcode or assume data values**
- Always use actual data from user-provided sources
- Verify data accuracy before creating comparison tables
- Double-check all calculations and references

## 📋 **OPERATIONAL GUIDELINES:**

### **Git Workflow:**
- Use `git status` to check current state
- Use `git pull` to sync with remote
- Use `git stash` for temporary changes
- Use `git reset --hard` only when necessary
- Always commit with descriptive messages

### **File Management:**
- Always read files before editing
- Use proper file paths (relative to workspace)
- Clean up temporary files after use
- Update documentation files when making changes

### **Error Handling:**
- Always check for undefined errors
- Fix errors immediately when identified
- Never leave broken code in place
- Test fixes before proceeding

### **Communication:**
- Be honest about mistakes and limitations
- Ask for clarification when uncertain
- Provide clear explanations of changes
- Update TODO lists and documentation regularly

## 🎯 **QUALITY STANDARDS:**
- Code must pass all linting checks
- Functions must be under complexity limits
- All changes must be tested before deployment
- Documentation must be updated with changes
- User feedback must be incorporated promptly

## 📝 **DOCUMENTATION REQUIREMENTS:**
- Update PROJECT_STATUS.md after major changes
- Update STANDING_RULES.md when new rules are established
- Update AI_TODO.md regularly with current tasks
- Create restore points before major changes
- Document all significant decisions and changes