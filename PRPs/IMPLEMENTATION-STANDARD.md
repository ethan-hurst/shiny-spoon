# PRP Implementation Standard

This document defines the standard that all PRP implementations must meet to be considered complete and production-ready.

## Implementation Checklist Template

Every PRP implementation MUST include:

### 1. Code Implementation ✅
- [ ] All features described in PRP document are implemented
- [ ] Code follows existing patterns and conventions
- [ ] TypeScript types are properly defined (no `any` types)
- [ ] All database queries use proper types from `database.types.ts`
- [ ] Components follow shadcn/ui patterns
- [ ] Server actions handle errors gracefully
- [ ] Loading and error states implemented

### 2. Testing Requirements 🧪
- [ ] Unit tests for utility functions
- [ ] Integration tests for server actions
- [ ] E2E tests for critical user flows
- [ ] Edge case handling (empty states, max limits, etc.)
- [ ] Error scenarios tested
- [ ] Performance tested with realistic data volumes

### 3. Validation Loops 🔄
Every PRP must include validation loops as defined in the PRP document:

#### Level 1: Syntax & Style
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm prettier --check .` passes
- [ ] `pnpm tsc --noEmit` shows no TypeScript errors

#### Level 2: Build Validation  
- [ ] `pnpm build` completes successfully
- [ ] No console errors or warnings
- [ ] Bundle size is reasonable

#### Level 3: Functional Testing
- [ ] All success criteria from PRP are met
- [ ] Manual testing covers all user flows
- [ ] Data persistence works correctly
- [ ] Real-time features work (if applicable)

#### Level 4: Integration Testing
- [ ] Works with other implemented features
- [ ] Database constraints are respected
- [ ] RLS policies work correctly
- [ ] API responses are performant

### 4. Security Requirements 🔒
- [ ] RLS policies implemented and tested
- [ ] No client-side exposure of sensitive data
- [ ] Service role key only used server-side
- [ ] Input validation on all forms
- [ ] SQL injection prevention
- [ ] XSS prevention

### 5. Performance Standards ⚡
- [ ] Page loads < 2 seconds
- [ ] API responses < 200ms for reads
- [ ] Debouncing on search/filter inputs
- [ ] Pagination for large datasets
- [ ] Optimistic updates where appropriate
- [ ] Database indexes for common queries

### 6. Documentation 📚
- [ ] Code comments for complex logic
- [ ] README updated with new features
- [ ] API documentation (if new endpoints)
- [ ] Database schema documented
- [ ] User-facing documentation (if needed)

### 7. Error Handling 🚨
- [ ] All async operations have try/catch
- [ ] User-friendly error messages
- [ ] Error logging for debugging
- [ ] Graceful degradation
- [ ] Network error handling
- [ ] Toast notifications for user feedback

### 8. Accessibility ♿
- [ ] Keyboard navigation works
- [ ] ARIA labels where needed
- [ ] Color contrast passes WCAG AA
- [ ] Screen reader compatible
- [ ] Focus management in modals/dialogs

### 9. Monitoring & Observability 📊
- [ ] Key actions logged
- [ ] Performance metrics captured
- [ ] Error tracking configured
- [ ] Analytics events (if applicable)

### 10. Migration & Rollback 🔄
- [ ] Database migrations are idempotent
- [ ] Rollback plan documented
- [ ] Data migration scripts tested
- [ ] Backward compatibility considered

## Implementation Workflow

1. **Pre-Implementation Review**
   - Read PRP document thoroughly
   - Review existing code patterns
   - Check dependencies and requirements
   - Plan implementation approach

2. **Implementation Phase**
   - Follow PRP task list sequentially
   - Use TodoWrite to track progress
   - Commit frequently with clear messages
   - Run validation loops after each major change

3. **Testing Phase**
   - Write tests alongside implementation
   - Test edge cases and error scenarios
   - Verify performance with realistic data
   - Cross-browser testing

4. **Review Phase**
   - Self-review against this checklist
   - Run all validation loops
   - Update documentation
   - Create PR with detailed description

5. **Post-Implementation**
   - Update PRP-STATUS.md
   - Document any deviations from PRP
   - Note any technical debt created
   - Plan follow-up tasks if needed

## Common Implementation Patterns

### Server Actions Pattern
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schema = z.object({
  // Define input validation
})

export async function actionName(input: z.infer<typeof schema>) {
  try {
    // Validate input
    const validated = schema.parse(input)
    
    // Get authenticated client
    const supabase = createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    
    // Perform operation
    const { data, error } = await supabase
      .from('table')
      .insert(validated)
      .select()
      .single()
      
    if (error) throw error
    
    // Revalidate cache
    revalidatePath('/path')
    
    return { success: true, data }
  } catch (error) {
    console.error('Action failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

### Component Pattern
```typescript
'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function FeatureComponent() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  
  async function handleAction() {
    try {
      setLoading(true)
      const result = await serverAction()
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Operation completed successfully'
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Button onClick={handleAction} disabled={loading}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Perform Action
    </Button>
  )
}
```

### Data Table Pattern
```typescript
'use client'

import { DataTable } from '@/components/ui/data-table'
import { columns } from './columns'
import { useDataTable } from '@/hooks/use-data-table'

export function FeatureTable({ data }) {
  const table = useDataTable({
    data,
    columns,
    searchKey: 'name',
    defaultSort: { id: 'created_at', desc: true }
  })
  
  return <DataTable table={table} />
}
```

## Anti-Patterns to Avoid

- ❌ Implementing features not in the PRP
- ❌ Skipping validation loops
- ❌ Using `any` types in TypeScript
- ❌ Client-side database queries
- ❌ Hardcoding values instead of env vars
- ❌ Skipping error handling
- ❌ Not testing edge cases
- ❌ Ignoring performance requirements
- ❌ Creating new patterns instead of following existing ones
- ❌ Committing sensitive data or keys

## Retroactive Fix Process

For PRPs that were implemented before this standard:

1. **Audit Current Implementation**
   - Review code against PRP document
   - Identify missing features or requirements
   - Check test coverage
   - Review error handling

2. **Create Fix Plan**
   - List all gaps found
   - Prioritize by impact
   - Estimate effort for each fix
   - Create tasks in TodoWrite

3. **Implement Fixes**
   - Follow standard patterns
   - Add missing tests
   - Improve error handling
   - Update documentation

4. **Validate Fixes**
   - Run all validation loops
   - Test thoroughly
   - Update PRP-STATUS.md
   - Document completion

This standard ensures consistent, high-quality implementations across all features of the TruthSource platform.