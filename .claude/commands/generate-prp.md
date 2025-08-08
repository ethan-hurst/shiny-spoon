# Create PRP

## Feature file: $ARGUMENTS

Generate a complete, self-sufficient PRP (Product Requirements Plan) for feature implementation with comprehensive research, validation, and machine-readable enforcement artifacts.

## Summary of Required Output Artifacts (ALL MUST BE GENERATED)

1. PRP Markdown: `PRPs/Phase X/PRP-XXX.md`
2. Machine Checklist: `PRPs/Phase X/PRP-XXX.checklist.json`
3. Status Entry (append or update): `PRP-STATUS.md`
4. Optional Migration Stubs: `supabase/migrations/XXXXXXXXXX_<slug>.sql`
5. Feature Flag Registration (if any): update `lib/flags/registry.ts` (declare in PRP)

## Machine Checklist JSON Schema (STRICT)

```jsonc
{
  "prp": "PRP-017",
  "title": "Bulk Operations Engine",
  "phase": 5,
  "risk": { "surfaceArea": 5, "dataSensitivity": 4, "externalIntegrations": 2, "score": 11, "tier": "HIGH" },
  "dependencies": ["PRP-010", "PRP-012"],
  "flags": [
    { "name": "bulk_ops", "default": false, "removalCriteria": ["95% success rate 30d", "Rollback tested"] }
  ],
  "sections": { "goal": true, "why": true, "what": true, "context": true, "blueprint": true, "validationGates": true, "riskAssessment": true, "featureFlags": true, "rollbackPlan": true },
  "acceptanceCriteria": [
    { "id": "AC-1", "text": "Can process 100k records < 10m", "type": "performance", "metric": { "target": 600, "unit": "seconds" } },
    { "id": "AC-2", "text": "Real-time progress events emitted <=2s interval", "type": "realtime", "metric": { "target": 2, "unit": "seconds" } }
  ],
  "tasks": [
    { "id": "DB-1", "desc": "Create bulk_operations table", "category": "database", "dependsOn": [] },
    { "id": "RLS-1", "desc": "RLS policies for bulk_operations", "category": "security", "dependsOn": ["DB-1"] }
  ],
  "gates": {
    "lint": true,
    "build": true,
    "policyTests": true,
    "perfTest": { "command": "pnpm test:perf bulk-ops", "required": true },
    "coverage": { "statements": 0.85, "branches": 0.75, "functions": 0.85, "lines": 0.85 }
  },
  "migrations": [
    { "filename": "20250208_bulk_operations.sql", "rollback": "DROP TABLE IF EXISTS bulk_operations CASCADE;" }
  ],
  "observability": {
    "events": [
      { "name": "bulk.operation.started", "fields": ["operation_id", "organization_id", "entity_type", "chunk_size"] },
      { "name": "bulk.operation.chunk.processed", "fields": ["operation_id", "processed", "failed", "duration_ms"] }
    ],
    "metrics": [
      { "name": "bulk_chunk_latency_ms", "type": "histogram", "targetP95": 500 },
      { "name": "bulk_failure_rate", "type": "gauge", "targetMax": 0.02 }
    ]
  },
  "rollback": {
    "strategy": "Transactional partial + idempotent replay",
    "steps": ["Mark operation failed", "Reapply before_data where action=update/delete"],
    "verification": ["All reversed rows match before_data hash"]
  }
}
```

MANDATORY: Every PRP must produce a valid JSON (no comments) adhering to the above key structure. Add fields if needed but NEVER omit baseline keys.

## Pre-Generation Validation

1. **Input Validation**
   - Verify feature file exists
   - Validate feature file required headers: `# Feature:`, `## Problem`, `## Requirements`
   - Check PRP number uniqueness & phase directory existence
   - Reject if overlapping feature scope with existing active PRPs (scan titles for similar keywords)
2. **Dependency Analysis**
   - Parse `Dependencies:` section of feature file or fallback to detection (references to tables/endpoints)
   - Ensure all listed dependencies present in `PRP-STATUS.md` with status >= Implemented
   - If unmet, mark PRP as `Blocked` in generated status entry
3. **Context Gathering**
   - Load `IMPLEMENTATION-STANDARD.md` & `COMPLETE-IMPLEMENTATION-GUIDE.md`
   - Extract canonical patterns (server action, component, RLS policy, testing)

## Research Process (Depth-First)

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

## NEW REQUIRED SECTIONS (Must Appear in PRP Markdown)

1. Feature Flags
   - Table of flags with: name, scope (ui/api/job), default, owner, removal criteria
   - Each acceptance criterion mapped to whether pre or post-flag
2. Risk Assessment
   - Surface Area (1-5), Data Sensitivity (1-5), External Integrations (count) → computed score & tier (LOW <6, MED 6-10, HIGH 11-14, CRITICAL ≥15)
   - Mitigations list per high-risk vector
3. Observability Plan
   - Event list + fields + sampling rate
   - Metrics + type + SLO target
   - Dashboard outline (panels, queries)
4. Rollback Plan (Executable)
   - Migration reversal commands
   - Data correction steps
   - Verification queries
5. RLS & Security Matrix
   - Table: table | operation | policy name | tested (Y/N) | notes
6. Test Matrix
   - AC id ↔ test file path pattern
   - Include policy tests, perf tests, E2E flows
7. Launch Criteria
   - Gated metrics (error rate thresholds, p95 latency, coverage delta)
   - Flag removal prerequisites
8. Change Impact Map
   - Affected domains (auth, billing, pricing, inventory, jobs)

## Implementation Blueprint Enhancements

Add explicit subsections: Schema, APIs, Server Actions, Background Jobs, Feature Flags Wiring, Security/RLS, Observability Hooks, Testing Scaffolds, Rollback Steps.

## Validation Gates (Augmented)

Add mandatory gates beyond existing:

```bash
# Policy Tests
pnpm test:policies --runInBand

# Coverage Delta (enforced by CI script reading checklist JSON)
node scripts/ci/check-coverage-delta.mjs PRPs/PhaseX/PRP-XXX.checklist.json

# Performance (only if perfTest.required=true)
pnpm test:perf bulk-ops

# Observability Lint (ensures required events emitted)
node scripts/ci/verify-events.mjs PRPs/PhaseX/PRP-XXX.checklist.json
```

If risk tier = HIGH or CRITICAL then also require:
```bash
pnpm test:load --scenario PRP-XXX
```

## Machine Readability & CI Integration

- Checklist JSON is single source of truth; CI jobs parse it.
- README and marketing claims must reference only PRPs with `production=true` (set when feature flag removed & launch criteria passed).
- A PR merges only if all `gates` conditions satisfied.

## ULTRATHINK Phase (Expanded)

Add:
- Alternative Approaches Comparison (table w/ trade-offs & chosen rationale)
- Failure Mode Enumeration (per component: detection, mitigation, user impact)
- Data Integrity Validation Strategy (hashing, row counts, reconciliation queries)

## Output Generation (Revised)

1. Select next PRP number (scan existing numbers)
2. Generate Markdown & JSON simultaneously; JSON must include SHA256 hash of markdown in `sourceHash`
3. Append status entry with initial state `📄 Documented` or `⛔ Blocked`
4. Echo summary to console: PRP number, risk tier, unmet dependencies

## Quality Checklist (Updated)

Add checks:
- [ ] JSON validates against schema
- [ ] All acceptance criteria have unique IDs & test mapping
- [ ] All migrations list rollback
- [ ] All feature flags have removal criteria
- [ ] Observability events enumerate required fields
- [ ] Risk tier computed correctly
- [ ] No claims of implementation (only future) until status changes

## Confidence Scoring (Add Dimension)

Add: **Risk Mitigation Coverage** (percentage of identified risks with explicit mitigation steps).

Overall score must include weighted penalty if any acceptance criterion lacks a mapped test.

## Prohibited Content (Enforce via Grep Section)

Extend mock detection to block words: `PLACEHOLDER_IMPLEMENTATION`, `NOT_YET_IMPLEMENTED`, `TEMP_`, `DEBUG_ONLY`.

## Post-Generation Verification (Augmented)

- Validate feature flag definitions compile (if registry updated)
- Run JSON schema validation script (document command)
- Verify rollback steps are executable (dry-run explanation if destructive)

## CRITICAL Enforcement Notes

Failure to include machine checklist or risk assessment = INVALID PRP.
Any TODO/FIXME found in generated code examples invalidates the PRP.

---

All above changes make PRPs executable, enforceable, and self-governing.
