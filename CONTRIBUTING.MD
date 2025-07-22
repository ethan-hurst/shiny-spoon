# Contributing to TruthSource

First off, thank you for considering contributing to TruthSource! 🎉

We're building a platform that helps B2B companies eliminate costly order errors, and every contribution helps us save businesses hundreds of thousands of dollars annually. Whether you're fixing a typo, adding a feature, or improving documentation, your help is valued.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Supabase Guidelines](#supabase-guidelines)
- [Documentation](#documentation)

## 🤝 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our Code of Conduct:

- **Be Respectful**: Treat everyone with respect. No harassment or discrimination.
- **Be Collaborative**: Work together to resolve conflicts constructively.
- **Be Professional**: Keep discussions focused and productive.
- **Be Inclusive**: Welcome newcomers and help them get started.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- Node.js 18+ and pnpm installed
- A Supabase account (free tier is fine)
- Git configured with your GitHub account
- VS Code with recommended extensions (see `.vscode/extensions.json`)

### Understanding TruthSource

Before diving into code:

1. Read the [README.md](README.md) for project overview
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
3. Check [CLAUDE.md](CLAUDE.md) for AI assistant context
4. Browse [open issues](https://github.com/truthsource/truthsource/issues) for ideas

## 💻 Development Setup

### 1. Fork and Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR-USERNAME/truthsource.git
cd truthsource
git remote add upstream https://github.com/truthsource/truthsource.git
```

### 2. Install Dependencies

```bash
# We use pnpm for faster installs
pnpm install

# Install Supabase CLI globally
npm install -g supabase
```

### 3. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your Supabase project details:
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Database Setup

```bash
# Start Supabase locally (optional but recommended)
pnpm supabase start

# This will output your local Supabase credentials
# Update .env.local with these local credentials for development

# Apply database migrations
pnpm supabase db push

# Generate TypeScript types from your schema
pnpm db:generate-types

# Seed development data
pnpm db:seed
```

### 5. Start Development Server

```bash
# Start Next.js development server
pnpm dev

# In another terminal, start Supabase Edge Functions (if needed)
pnpm supabase functions serve
```

### 6. Verify Setup

```bash
# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test

# Access the app
open http://localhost:3000
```

## 🤔 How to Contribute

### Finding Something to Work On

1. **Good First Issues**: Look for [`good first issue`](https://github.com/truthsource/truthsource/labels/good%20first%20issue) labels
2. **Documentation**: Always needed and appreciated
3. **Tests**: Improve test coverage (aim for 80%+)
4. **Performance**: Profile and optimize slow queries or components
5. **Accessibility**: Improve keyboard navigation and screen reader support

### Before Starting Work

1. **Check Existing PRs**: Ensure nobody else is working on it
2. **Comment on Issue**: Say "I'd like to work on this"
3. **Ask Questions**: If unclear, ask in the issue
4. **Propose Solution**: For complex issues, outline your approach

## 📝 Coding Standards

### TypeScript & Next.js Guidelines

```typescript
// ✅ DO: Use Server Components by default
// app/(dashboard)/products/page.tsx
export default async function ProductsPage() {
  const supabase = createServerClient()
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  return <ProductList products={products} />
}

// ✅ DO: Use 'use client' only when needed
'use client'

export function InteractiveComponent() {
  const [state, setState] = useState()
  // Interactive features here
}

// ✅ DO: Use Server Actions for mutations
// app/actions/products.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  price: z.number().positive()
})

export async function createProduct(formData: FormData) {
  const supabase = createServerClient()

  // Validate input
  const parsed = createProductSchema.parse({
    sku: formData.get('sku'),
    name: formData.get('name'),
    price: Number(formData.get('price'))
  })

  // Insert with RLS
  const { error } = await supabase
    .from('products')
    .insert(parsed)

  if (error) throw error

  revalidatePath('/products')
}

// ❌ DON'T: Use any type
const processData = (data: any) => {} // BAD!

// ❌ DON'T: Forget organization context
const products = await supabase
  .from('products')
  .select('*') // BAD - No org filter!
```

### Component Structure

```typescript
// components/features/inventory/inventory-table.tsx
import { Card } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import type { Inventory } from '@/types/database'

interface InventoryTableProps {
  data: Inventory[]
  warehouseId?: string
}

export function InventoryTable({ data, warehouseId }: InventoryTableProps) {
  // Component implementation
}
```

### Styling with Tailwind CSS

```tsx
// ✅ DO: Use Tailwind utilities
<div className="flex items-center justify-between p-4 border rounded-lg">

// ✅ DO: Use CSS variables for themes
<div className="bg-background text-foreground">

// ❌ DON'T: Use inline styles
<div style={{ display: 'flex' }}> // BAD!

// ❌ DON'T: Create unnecessary CSS files
```

### Form Handling

```tsx
// Always use React Hook Form + Zod
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

const formSchema = z.object({
  email: z.string().email(),
  quantity: z.number().min(0).max(99999),
})

export function MyForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      quantity: 0,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const formData = new FormData()
    Object.entries(values).forEach(([key, value]) => {
      formData.append(key, value.toString())
    })

    await serverAction(formData)
  }
}
```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(inventory): add bulk upload functionality

- Implement CSV parser for inventory data
- Add validation for SKU format
- Include progress indicator during upload

Closes #123
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/changes
- `chore`: Maintenance tasks

## 🧪 Testing Requirements

### Test Coverage Standards

- Minimum 80% code coverage
- 100% coverage for critical business logic
- All user flows must have E2E tests
- All Server Actions must have tests

### Writing Tests

```typescript
// E2E Test with Playwright
// tests/e2e/inventory-management.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
  })

  test('should update inventory quantity', async ({ page }) => {
    await page.goto('/inventory')

    // Find product row
    const row = page.locator('tr', { hasText: 'WIDGET-001' })

    // Click edit button
    await row.locator('button[aria-label="Edit quantity"]').click()

    // Update quantity
    await page.fill('[name="quantity"]', '150')
    await page.click('button[type="submit"]')

    // Verify update
    await expect(row.locator('[data-testid="quantity"]')).toHaveText('150')
  })
})

// Component Test
// components/features/inventory/__tests__/inventory-table.test.tsx
import { render, screen } from '@testing-library/react'
import { InventoryTable } from '../inventory-table'

describe('InventoryTable', () => {
  it('renders inventory data correctly', () => {
    const mockData = [
      {
        id: '1',
        sku: 'WIDGET-001',
        quantity: 100,
        warehouse: 'Main'
      }
    ]

    render(<InventoryTable data={mockData} />)

    expect(screen.getByText('WIDGET-001')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run E2E tests with UI
pnpm test:e2e:ui

# Run specific test file
pnpm test inventory-table.test.tsx

# Run with coverage
pnpm test:coverage
```

## 🔄 Pull Request Process

### 1. Create Feature Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feat/add-inventory-import
```

### 2. Make Your Changes

- Write code following our standards
- Add/update tests
- Update documentation
- Run linter: `pnpm lint`
- Run type check: `pnpm typecheck`
- Run tests: `pnpm test`

### 3. Test Locally

```bash
# Build the app
pnpm build

# Test the production build
pnpm start
```

### 4. Push and Create PR

```bash
# Push to your fork
git push origin feat/add-inventory-import
```

### PR Template

Your PR should include:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)

[Add screenshots for UI changes]

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.logs left
- [ ] Database migrations included (if needed)
```

## 🗄 Supabase Guidelines

### Database Migrations

```bash
# Create a new migration
pnpm supabase migration new add_customer_tiers

# Edit the migration file
# supabase/migrations/[timestamp]_add_customer_tiers.sql
```

Example migration:

```sql
-- Add customer tiers table
CREATE TABLE customer_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  min_order_value DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS
ALTER TABLE customer_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can manage tiers" ON customer_tiers
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Add indexes
CREATE INDEX idx_customer_tiers_org ON customer_tiers(organization_id);
```

### RLS (Row Level Security) Rules

Every table MUST have RLS enabled:

```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Basic org isolation
CREATE POLICY "org_isolation" ON your_table
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );
```

### Edge Functions

```typescript
// supabase/functions/calculate-shipping/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { items, destination } = await req.json()

  // Function logic here

  return new Response(JSON.stringify({ shipping: calculated }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

## 📚 Documentation

### Where to Add Documentation

- **Component Documentation**: In component files using JSDoc
- **API Changes**: Update `docs/technical/supabase-integration-guide.md`
- **New Features**: Add to `docs/features/`
- **Architecture Changes**: Update `ARCHITECTURE.md`

### Documentation Standards

```tsx
/**
 * Displays inventory data in a sortable, filterable table
 *
 * @example
 * <InventoryTable
 *   data={inventoryData}
 *   warehouseId="wh-001"
 *   onUpdate={handleUpdate}
 * />
 */
export function InventoryTable({ data, warehouseId, onUpdate }: Props) {
  // Implementation
}
```

## 💬 Getting Help

- **Discord**: Join our [Discord server](https://discord.gg/truthsource)
- **Documentation**: Check [docs/](docs/) folder
- **Issues**: Ask questions in GitHub issues

## Quick Commands Reference

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:generate-types # Generate TypeScript types
pnpm db:seed          # Seed development data
pnpm supabase status  # Check local Supabase

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm typecheck        # TypeScript type checking
pnpm format           # Format with Prettier

# Testing
pnpm test             # Run all tests
pnpm test:e2e         # E2E tests only
pnpm test:e2e:ui      # E2E with Playwright UI
pnpm test:coverage    # Generate coverage report
```

---

Thank you for contributing to TruthSource! Together, we're building the single source of truth for B2B commerce. 🚀
