# Create PRP

## Feature file: $ARGUMENTS

Generate a complete, self-sufficient PRP (Product Requirements Plan) for feature implementation with comprehensive research and validation. The PRP must contain all context needed for successful one-pass implementation.

## Pre-Generation Validation

1. **Input Validation**
   - Verify feature file exists at specified path
   - Validate feature file format and required sections
   - Check for feature name conflicts in existing PRPs
   - Ensure no duplicate PRP numbers

2. **Dependency Analysis**
   - Review PRP-STATUS.md for required dependencies
   - Identify prerequisite PRPs that must be implemented first
   - Map integration points with existing features

3. **Context Gathering**
   - Read IMPLEMENTATION-STANDARD.md for requirements
   - Read COMPLETE-IMPLEMENTATION-GUIDE.md for patterns
   - Analyze project structure and conventions

## Research Process

### 1. **Feature File Analysis**
   - Read and parse the feature file completely
   - Extract requirements, constraints, and examples
   - Identify acceptance criteria and success metrics
   - Note any specific patterns or approaches mentioned

### 2. **Codebase Research** (Systematic and Thorough)
   - **Pattern Discovery**:
     ```bash
     # Find similar features
     grep -r "similar_feature" --include="*.tsx" --include="*.ts"
     
     # Analyze component patterns
     find . -name "*.tsx" -path "*/components/*" | head -20
     
     # Review server actions
     find . -name "*.ts" -path "*/actions/*"
     ```
   - **Convention Analysis**:
     - Database query patterns
     - Error handling approaches
     - Form validation strategies
     - State management patterns
   - **Test Pattern Review**:
     - Unit test structure
     - Integration test approaches
     - E2E test scenarios

### 3. **External Research** (Document Everything)
   - **Official Documentation**:
     - Framework docs (Next.js, React, etc.)
     - Library APIs (with version specifics)
     - Best practices guides
   - **Implementation Examples**:
     - GitHub repositories
     - Stack Overflow solutions
     - Blog posts and tutorials
   - **Performance Considerations**:
     - Benchmarks and optimization techniques
     - Common bottlenecks and solutions

### 4. **Technical Validation**
   - Verify library compatibility
   - Check for security implications
   - Validate performance requirements feasibility
   - Assess accessibility requirements

## PRP Structure Requirements

### 1. **Goal Section**
   - Clear, concise objective (1-2 sentences)
   - Measurable outcome
   - Business value proposition

### 2. **Why Section**
   - Business value with metrics
   - Integration benefits
   - Problems being solved
   - Risk mitigation

### 3. **What Section**
   - Detailed feature description
   - Success criteria (checkbox format)
   - Acceptance tests
   - Performance benchmarks

### 4. **Context Section** (CRITICAL)
   - **Documentation & References**:
     ```yaml
     - url: [specific documentation URL]
       why: [specific reason for reference]
       section: [exact section if applicable]
     
     - file: [codebase file path]
       why: [pattern or example to follow]
       lines: [specific line numbers if relevant]
     ```
   - **Codebase Tree**: Current relevant structure
   - **Dependencies**: Required PRPs and libraries
   - **Gotchas**: Known issues, version conflicts, workarounds

### 5. **Implementation Blueprint**
   - **Approach Overview**: High-level strategy
   - **Pseudocode**: Clear implementation steps with REAL operations
   - **File Structure**: New files and modifications
   - **Task Breakdown**: Ordered implementation tasks
   - **Error Handling**: Specific strategies for failures
   - **NO MOCK IMPLEMENTATIONS**:
     ```typescript
     // ❌ NEVER include mock implementations like:
     // setTimeout(() => setProgress(50), 1000)
     // const mockData = [{id: 1, name: 'Test'}]
     // const fakeUsers = generateFakeUsers(10)
     // const dummyResponse = {success: true}
     // console.log('Simulating API call...')
     // await sleep(1000) // artificial delay
     // function stubFunction() { return true }
     // <div>TODO: Implement this feature</div>
     // alert('Feature not implemented yet')
     
     // ✅ ALWAYS show real implementation patterns:
     // const { data } = await supabase.from('table').select()
     // const result = await processItems(items)
     // setProgress(processed / total * 100)
     // const response = await fetch('/api/endpoint')
     // toast.success('Operation completed')
     ```

### 6. **Validation Gates** (Must be Executable)
   ```bash
   # Level 1: Syntax & Style
   pnpm lint && pnpm prettier --check . && pnpm tsc --noEmit
   
   # Level 2: Build
   pnpm build
   
   # Level 3: Mock Detection
   grep -r "setTimeout.*progress" --include="*.ts" --include="*.tsx" || echo "No mock progress found ✓"
   grep -r "mock[A-Z]" --include="*.ts" --include="*.tsx" || echo "No mock data found ✓"
   grep -r "fake[A-Z]" --include="*.ts" --include="*.tsx" || echo "No fake data found ✓"
   grep -r "dummy[A-Z]" --include="*.ts" --include="*.tsx" || echo "No dummy data found ✓"
   grep -r "stub[A-Z]" --include="*.ts" --include="*.tsx" || echo "No stub functions found ✓"
   grep -r "TODO.*implement" --include="*.ts" --include="*.tsx" || echo "No TODOs found ✓"
   grep -r "FIXME" --include="*.ts" --include="*.tsx" || echo "No FIXMEs found ✓"
   grep -r "console\.log.*simula" --include="*.ts" --include="*.tsx" || echo "No simulations found ✓"
   grep -r "alert\(" --include="*.ts" --include="*.tsx" || echo "No alerts found ✓"
   grep -r "sleep\(" --include="*.ts" --include="*.tsx" || echo "No sleep delays found ✓"
   
   # Level 4: Tests (if applicable)
   pnpm test [specific test files]
   
   # Level 5: Feature Validation
   # Specific commands to verify feature works with REAL data
   # Must include actual database operations
   ```

## ULTRATHINK Phase (REQUIRED)

Before writing the PRP, perform deep analysis:

1. **Completeness Check**
   - Can an AI implement this with ONLY the PRP content?
   - Are all external references included with URLs?
   - Are code patterns explicitly shown?

2. **Risk Assessment**
   - What could go wrong during implementation?
   - What error cases need handling?
   - What performance issues might arise?

3. **Integration Planning**
   - How does this affect existing features?
   - What migrations are needed?
   - What backwards compatibility concerns exist?

4. **Quality Gates**
   - Are validation commands actually executable?
   - Do success criteria cover all requirements?
   - Are test scenarios comprehensive?

## Output Generation

### 1. **File Creation**
   - Save as: `PRPs/Phase X/PRP-XXX.md`
   - Use next available PRP number
   - Follow naming convention exactly

### 2. **Quality Validation**
   - Run through quality checklist
   - Score confidence level (1-10)
   - Document any concerns or limitations

### 3. **Status Update**
   - Add entry to PRP-STATUS.md
   - Mark as "📄 Documented"
   - List dependencies

## Quality Checklist

- [ ] Feature file thoroughly analyzed
- [ ] All needed context included in PRP
- [ ] Validation gates are executable commands
- [ ] References include specific URLs/files/lines
- [ ] Implementation blueprint is detailed
- [ ] Error handling explicitly documented
- [ ] Dependencies clearly listed
- [ ] Success criteria are measurable
- [ ] No assumptions about external knowledge
- [ ] PRP is self-contained for implementation
- [ ] **NO mock implementations or placeholders**
- [ ] **All code examples use real database/API calls**
- [ ] **Progress tracking shows actual async operations**
- [ ] **Test data comes from real sources**

## Confidence Scoring

Rate the PRP on these factors (1-10 each):
- **Completeness**: All information present
- **Clarity**: Easy to understand and follow
- **Executability**: Can be implemented without questions
- **Validation**: Clear success/failure criteria
- **Context**: All references and examples included

**Overall Score**: [Average of above] / 10

**Target**: Minimum 8/10 for release

## Common Pitfalls to Avoid

1. **Vague References**: "Follow existing patterns" without showing them
2. **Missing Context**: Assuming knowledge of libraries/frameworks
3. **Unclear Validation**: "Test that it works" vs specific commands
4. **Incomplete Research**: Not checking for similar implementations
5. **Poor Structure**: Missing required sections or unclear organization

## Post-Generation Verification

1. Re-read the PRP as if you know nothing about the project
2. Verify all external links work
3. Check that code examples are complete
4. Ensure validation commands are correct
5. Confirm PRP number is unique

Remember: The goal is ONE-PASS implementation success. Every piece of context matters.

## 🚫 CRITICAL: Production-Ready Code Only

**NEVER include in PRPs:**
- Mock/fake/dummy data or simulated responses
- setTimeout/sleep/delay for artificial delays or progress
- Stub/placeholder functions that don't work
- Console.log instead of real operations
- TODO/FIXME comments in implementation
- Hardcoded test data or static arrays
- Alert() for user notifications
- "Not implemented" messages or buttons
- generateMock* or createFake* functions
- Artificial loading states without real operations

**ALWAYS include in PRPs:**
- Real Supabase query examples with error handling
- Actual async operation handling with try/catch
- Complete error handling flows with user feedback
- Real-time progress tracking from actual operations
- Production-ready code snippets that work
- Working API integration examples
- Proper loading states with Skeleton components
- Toast notifications for user feedback
- Complete form submissions with validation
- Real data fetching and state management