# Create PRP

## Feature file: $ARGUMENTS

Generate a complete, self-sufficient PRP (Product Requirements Plan) for feature implementation with comprehensive research, validation, and automated quality enforcement built-in from the start.

## 🚀 Quick Start: Automation-First Approach

Before creating the PRP, identify which generators and base classes will be used:

```bash
# Available generators the implementation will use:
npm run generate:api <name>        # APIs with rate limiting
npm run generate:service <name>    # Services with retry logic
npm run generate:repository <name> # Repositories with RLS
npm run generate:component <name>  # Components with loading states
```

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
   - **Check which base classes to extend**
   - **Identify reusable templates**

3. **Context Gathering**
   - Read IMPLEMENTATION-STANDARD.md for requirements
   - Read COMPLETE-IMPLEMENTATION-GUIDE.md for patterns
   - Analyze project structure and conventions
   - **Map to existing base classes (BaseService, BaseRepository)**
   - **Identify which templates to copy**

## Research Process

### 1. **Feature File Analysis**

- Read and parse the feature file completely
- Extract requirements, constraints, and examples
- Identify acceptance criteria and success metrics
- Note any specific patterns or approaches mentioned

### 2. **Codebase Research** (Focus on Reusability)

- **Base Class Discovery**:

  ```bash
  # Find base classes to extend
  find . -name "base-*.ts" -path "*/lib/*"
  grep -r "extends Base" --include="*.ts"

  # Find templates to copy
  find . -path "*/templates/*" -name "*.template.*"

  # Find existing generators
  grep -r "generate:" package.json
  ```

- **Pattern Analysis**:
  - Which base classes provide needed functionality
  - Which templates match the use case
  - Which generators can scaffold the feature
  - Existing middleware/wrappers to reuse
  
- **Security Pattern Review**:
  - Rate limiting implementations
  - Organization isolation patterns
  - CSRF protection methods
  - Auth middleware usage

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

### 5. **Implementation Blueprint** (Automation-First)

- **Generation Strategy**: Which parts to generate vs extend
  ```bash
  # Step 1: Generate base files
  npm run generate:api feature-name
  npm run generate:service feature-name
  
  # Step 2: Extend base classes
  class FeatureService extends BaseService<Feature> {
    // Only implement feature-specific logic
  }
  ```

- **Base Class Usage**: Show exactly which to extend
  ```typescript
  // API Route - Use createRouteHandler
  export const POST = createRouteHandler({
    schema: inputSchema,
    rateLimit: { requests: 100, window: '1h' },
    handler: async ({ input, user, supabase }) => {
      // Feature logic here
    }
  })
  
  // Service - Extend BaseService
  class FeatureService extends BaseService<Feature> {
    protected entityName = 'feature'
    // Automatic: retry, monitoring, circuit breaker
  }
  
  // Repository - Extend BaseRepository  
  class FeatureRepository extends BaseRepository<Feature> {
    protected tableName = 'features'
    // Automatic: org isolation, soft deletes, audit
  }
  ```

- **Template References**: Which templates to copy
- **Task Breakdown**: Ordered implementation with generators first
- **Built-in Quality**: What's automatically included

### 6. **Automated Quality Gates** (Built-In From Start)

Include these automated checks in the PRP:

```bash
# Pre-commit hooks (automatic)
npm run setup:hooks

# Real-time development guards
npm run dev:guards

# Automated validation suite
npm run check:all

# Specific feature validation
npm run validate:feature <feature-name>
```

**What Gets Checked Automatically:**
- ✅ Rate limiting on all APIs (pre-commit blocks if missing)
- ✅ Organization filtering on queries (dev guards catch immediately)
- ✅ TypeScript strict mode (no any types allowed)
- ✅ Test coverage >80% (CI/CD enforces)
- ✅ Security patterns (CSRF, auth, validation)

**Manual Validation Commands:**
```bash
# Only what automation can't check
npm run test:integration <feature>
npm run test:e2e <feature>
npm run perf:benchmark <feature>
```

## ULTRATHINK Phase (UPDATED)

Before writing the PRP, perform deep analysis:

1. **Automation Assessment**
   - Which parts can be generated automatically?
   - Which base classes solve common requirements?
   - Which templates provide the structure?
   - What custom logic is actually needed?

2. **Built-In Quality Check**
   - What quality measures are automatic with base classes?
   - What security is inherited from templates?
   - What monitoring comes built-in?
   - What additional checks are needed?

3. **5-Minute Rule Application**
   - Can developer implement in <5 minutes with generators?
   - Are instructions clear for using automation?
   - Is manual work minimized?
   - Are quick-start commands provided?

4. **Integration Planning**
   - How does this extend existing patterns?
   - Which middleware/wrappers to reuse?
   - What backwards compatibility concerns exist?
   - How to maintain consistency with base classes?

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

## Quality Checklist (Automation-First)

- [ ] **Generators identified** for scaffolding
- [ ] **Base classes specified** for extending
- [ ] **Templates referenced** for copying
- [ ] **Automation commands** provided upfront
- [ ] **Pre-commit hooks** mentioned for quality
- [ ] **Dev guards** specified for real-time checks
- [ ] Feature file thoroughly analyzed
- [ ] All needed context included in PRP
- [ ] Quick-start commands at the beginning
- [ ] 5-minute implementation possible
- [ ] Built-in quality measures documented
- [ ] Manual work minimized
- [ ] Success criteria are measurable
- [ ] No assumptions about external knowledge
- [ ] PRP is self-contained for implementation

## Confidence Scoring (Updated Criteria)

Rate the PRP on these factors (1-10 each):

- **Automation**: How much can be generated/extended (vs written)
- **Clarity**: Easy to understand and follow
- **Speed**: Can be implemented in <30 minutes
- **Quality**: Built-in checks prevent errors
- **Completeness**: All information present

**Overall Score**: [Average of above] / 10

**Target**: Minimum 8/10 for release

**Bonus Points**:
- +1 if 80%+ can be generated
- +1 if extends existing base classes
- +1 if includes real-time validation

## Common Pitfalls to Avoid

1. **Not Using Generators**: Writing from scratch when generators exist
2. **Not Extending Base Classes**: Reimplementing retry/monitoring/auth
3. **Manual Quality Checks**: Not leveraging automated enforcement
4. **Missing Quick Start**: No upfront automation commands
5. **Assuming Manual Work**: Not showing the automated path first

## Post-Generation Verification

1. Re-read the PRP as if you know nothing about the project
2. Verify all external links work
3. Check that code examples are complete
4. Ensure validation commands are correct
5. Confirm PRP number is unique

Remember: The goal is ONE-PASS implementation success with MINIMAL manual work.

## 📋 PRP Template Structure (Automation-First)

Each PRP should follow this structure:

```markdown
# PRP-XXX: [Feature Name]

## 🚀 Quick Start

```bash
# Generate the feature structure
npm run generate:api <feature-name>
npm run generate:service <feature-name>
npm run generate:repository <feature-name>

# Enable real-time quality checks
npm run dev:guards

# Your feature will have these automatically:
✅ Rate limiting on APIs
✅ Retry logic in services  
✅ Organization isolation in queries
✅ Error handling and monitoring
✅ TypeScript types and validation
```

## Goal
[What we're building - 1-2 sentences]

## Why This Matters
[Business value and problems solved]

## Implementation Approach

### Step 1: Use Generators (2 minutes)
```bash
npm run generate:api products/bulk-import
npm run generate:service bulk-import
```

### Step 2: Extend Base Classes (3 minutes)
```typescript
// Only implement feature-specific logic
export class BulkImportService extends BaseService<BulkImport> {
  protected entityName = 'bulk-import'
  
  async processBatch(items: Item[]): Promise<Result> {
    // Your logic here - retry/monitoring/circuit breaker included
    return this.withRetry(() => this.repository.createMany(items))
  }
}
```

### Step 3: Use Templates (2 minutes)
```bash
cp templates/api-route.ts app/api/bulk-import/route.ts
# Modify only the handler logic
```

## What's Built-In

When you extend our base classes, you get:
- 🔄 Automatic retry with exponential backoff
- 📊 Metrics and monitoring
- 🔌 Circuit breaker pattern
- 🔒 Organization isolation
- 📝 Audit logging
- ❌ Proper error handling

## Custom Implementation Required

[Only list what can't be generated or inherited]

## Validation

### Automated (Pre-commit)
- TypeScript compilation
- Rate limit verification
- Test coverage check
- Security pattern scan

### Manual Testing
```bash
npm run test:feature bulk-import
```

## Success Criteria
- [ ] All generated files pass validation
- [ ] Custom logic implemented and tested
- [ ] Feature works with real data
- [ ] Performance meets requirements
```

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
