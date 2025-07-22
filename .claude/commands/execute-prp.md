# Execute BASE PRP

Implement a feature using the PRP file with robust error handling and validation.

## PRP File: $ARGUMENTS

## Execution Process

### 1. **Pre-Execution Validation**

- Verify PRP file exists at specified path
- Check if PRP is already implemented (check PRP-STATUS.md)
- **CRITICAL: Even if marked as implemented, verify against current standards:**
  - Read the PRP document completely
  - Extract ALL specific file requirements
  - Check each required file exists with correct name/path
  - Validate file contents match PRP specifications
  - Run validation commands specified in the PRP
- Validate all dependencies are implemented
- Ensure required files exist:
  - PRPs/IMPLEMENTATION-STANDARD.md
  - COMPLETE-IMPLEMENTATION-GUIDE.md
  - PRPs/PRP-STATUS.md
- Create a rollback checkpoint (git stash or branch)

### 2. **Load and Analyze PRP**

- Read the specified PRP file
- Read PRPs/IMPLEMENTATION-STANDARD.md
- Read COMPLETE-IMPLEMENTATION-GUIDE.md
- Parse and validate PRP structure:
  - Acceptance criteria present
  - Dependencies listed
  - Files to create/modify specified
- Perform additional research if needed:
  - Search existing codebase for patterns
  - Web searches for technical requirements
  - Analyze related components and services

### 3. **ULTRATHINK - Comprehensive Planning**

- Create detailed implementation plan addressing ALL requirements
- Use TodoWrite tool to create granular task list including:
  - Pre-implementation checks
  - Core feature implementation
  - Database migrations/changes
  - UI components
  - Server actions/API endpoints
  - Validation implementation
  - Test creation
  - Documentation updates
- Identify potential risks and mitigation strategies
- Map existing code patterns to follow
- Plan for all 4 validation levels

### 4. **Execute Implementation**

- Work through todos systematically
- For each major change:
  - Implement the change with REAL functionality
  - Run Level 1 validation (syntax/style)
  - Fix any immediate issues
- Follow established patterns:
  - Use proper TypeScript types (no `any`)
  - Follow shadcn/ui component patterns
  - Implement proper error handling
  - Add loading and error states
- **CRITICAL: Production-Ready Requirements**
  - NO mock data - use real Supabase queries
  - NO setTimeout for progress - track actual async operations
  - NO placeholder functions - implement complete logic
  - NO hardcoded test data - fetch from database
  - NO console.log instead of real operations
- Commit frequently with descriptive messages

### 5. **Validation Loops**

**Level 0 - PRP-Specific File Validation:**

- Check ALL files listed in PRP "Files" section exist
- Validate configuration files match PRP specifications:
  - `.prettierrc` with exact config from PRP
  - `tsconfig.json` with ALL required settings
  - `.env.example` (not `.env.template`)
  - Package dependencies match requirements
- Run PRP-specific validation commands if any

**Level 1 - Syntax & Style Check:**

```bash
pnpm lint && pnpm prettier --check . && pnpm tsc --noEmit
```

- Fix any linting errors
- Format code with prettier if needed
- Resolve all TypeScript errors

**Level 2 - Build Validation:**

```bash
pnpm build
```

- Ensure build completes successfully
- Fix any build errors
- Verify all imports are correct

**Level 3 - Mock Implementation Detection:**

```bash
# Search for common mock patterns
grep -r "setTimeout.*progress" --include="*.ts" --include="*.tsx" || true
grep -r "mock[A-Z]" --include="*.ts" --include="*.tsx" || true
grep -r "fake[A-Z]" --include="*.ts" --include="*.tsx" || true
grep -r "dummy[A-Z]" --include="*.ts" --include="*.tsx" || true
grep -r "stub[A-Z]" --include="*.ts" --include="*.tsx" || true
grep -r "TODO.*implement" --include="*.ts" --include="*.tsx" || true
grep -r "FIXME" --include="*.ts" --include="*.tsx" || true
grep -r "console\.log.*simula" --include="*.ts" --include="*.tsx" || true
grep -r "alert\(" --include="*.ts" --include="*.tsx" || true
grep -r "Promise.*resolve.*setTimeout" --include="*.ts" --include="*.tsx" || true
grep -r "generateMock" --include="*.ts" --include="*.tsx" || true
grep -r "testData\s*=" --include="*.ts" --include="*.tsx" || true
grep -r "placeholder" --include="*.ts" --include="*.tsx" || true
grep -r "hardcoded.*data" --include="*.ts" --include="*.tsx" || true
grep -r "sleep\(" --include="*.ts" --include="*.tsx" || true
grep -r "delay\(" --include="*.ts" --include="*.tsx" || true
```

- If any mock patterns found, MUST replace with real implementation
- No setTimeout/sleep/delay for progress - use actual async operation tracking
- No mock/fake/dummy/stub data - connect to real database
- No placeholder UI or functions - implement complete features
- No console.log simulations - implement actual functionality
- No alert() for user feedback - use proper toast/modal
- No TODO/FIXME comments - complete the implementation

**Level 4 - Functional Testing:**

- Test all acceptance criteria from PRP
- Verify user flows work with REAL data
- Create actual database records
- Test actual API integrations
- Ensure performance requirements met (<2s page load, <200ms API)

**Level 5 - Integration Testing:**

- Test with other features using real data
- Verify RLS policies are enforced
- Check actual database constraints
- Validate real data integrity
- Test actual webhook processing

### 6. **Error Recovery**

If validation fails at any level:

- Identify the specific failure
- Use error patterns from PRP to fix
- Re-run the failed validation level
- If unable to fix after 3 attempts:
  - Document the issue
  - Consider rollback to checkpoint
  - Request user assistance

### 7. **Quality Assurance**

- Security checks:
  - RLS policies implemented and tested
  - No exposed service role keys
  - Input validation on all forms
  - SQL injection prevention
- Performance verification:
  - Debouncing on search/filters
  - Pagination for large datasets
  - Optimistic updates where appropriate
- Accessibility review:
  - Proper ARIA labels
  - Keyboard navigation
  - Screen reader compatibility

### 8. **Complete Implementation**

- Re-read the PRP to ensure nothing missed
- Verify all checklist items completed
- Run full validation suite one final time
- Update PRP-STATUS.md:
  - Change status to ✅ Implemented
  - List all created/modified files
  - Note any deviations or technical debt
- Generate completion report including:
  - Features implemented
  - Tests created
  - Performance metrics
  - Any outstanding issues

### 9. **Post-Implementation**

- Create a summary of changes
- Document any new patterns introduced
- Update relevant documentation
- Clean up any temporary files
- Remove rollback checkpoint if successful

## Error Handling Strategy

1. **Validation Failures:**
   - Log specific error with context
   - Attempt automated fix based on error type
   - Escalate to user if cannot resolve

2. **Build Failures:**
   - Check for missing dependencies
   - Verify import paths
   - Review TypeScript configurations

3. **Test Failures:**
   - Isolate failing test
   - Debug with console logs
   - Check for timing issues or race conditions

4. **Performance Issues:**
   - Profile slow operations
   - Add caching where appropriate
   - Optimize database queries

## Progress Tracking

- Use TodoWrite to maintain task list
- Update task status in real-time
- Report progress at major milestones
- Log all validation results
- Track time spent on each phase

## Retroactive PRP Validation

When checking PRPs marked as "Implemented":

1. **Never assume completion based on status alone**
2. **Always verify against current standards:**
   - Extract ALL file requirements from PRP
   - Check each file exists with exact name
   - Validate file contents match specifications
   - Run ALL validation commands from PRP
   - Check for specific config options (not just file existence)

3. **Common validation oversights to avoid:**
   - Assuming `.env.template` is same as `.env.example`
   - Checking only if `tsconfig.json` exists, not its contents
   - Missing dev tooling like husky/lint-staged
   - Not verifying prettier config matches PRP spec

4. **If discrepancies found:**
   - List ALL missing/incorrect items
   - Update implementation to match PRP exactly
   - Re-run all validation levels
   - Update PRP-STATUS.md only after full compliance

Note: This process ensures robust, error-free implementations that meet all TruthSource platform standards.
