# Testing Guide

This document provides comprehensive information about testing in the TruthSource application.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Organization](#test-organization)
- [Performance Testing](#performance-testing)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

TruthSource uses a comprehensive testing strategy to ensure code quality and reliability:

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test how different parts of the system work together
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Ensure the system meets performance requirements

## Test Infrastructure

### Testing Frameworks

- **Jest**: Unit and integration testing
- **React Testing Library**: React component testing
- **Playwright**: End-to-end testing
- **TypeScript**: Type safety in tests

### Configuration Files

- `jest.config.js`: Jest configuration
- `jest.setup.js`: Test environment setup
- `playwright.config.ts`: E2E test configuration
- `__tests__/utils/`: Test utilities and helpers

## Running Tests

### All Tests

```bash
npm run test:all
```

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed
```

### Performance Tests

```bash
# Run performance benchmarks
npm run test:perf
```

### Validation Scripts

```bash
# Validate PRP-001 (setup)
npm run validate:setup

# Validate PRP-002 (migrations)
npm run validate:migrations
```

## Writing Tests

### Unit Test Example

```typescript
// __tests__/unit/lib/utils.test.ts
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    const result = cn('text-base', 'font-bold', { 'text-red': true })
    expect(result).toBe('text-base font-bold text-red')
  })

  it('should handle Tailwind conflicts', () => {
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })
})
```

### Integration Test Example

```typescript
// __tests__/integration/actions/pricing.test.ts
import { createProductPricing } from '@/app/actions/pricing'

describe('Pricing Server Actions', () => {
  it('should create product pricing', async () => {
    const formData = new FormData()
    formData.append('product_id', 'test-product')
    formData.append('base_price', '100.00')

    await createProductPricing(formData)

    expect(mockSupabase.from).toHaveBeenCalledWith('product_pricing')
  })
})
```

### Component Test Example

```typescript
// __tests__/unit/components/button.test.tsx
import { render, screen } from '@/tests/utils/test-utils'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    await userEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### E2E Test Example

```typescript
// __tests__/e2e/inventory-update.spec.ts
import { expect, test } from '@playwright/test'

test('update inventory quantity', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'password')
  await page.click('button[type="submit"]')

  // Navigate and update
  await page.goto('/inventory')
  await page.click('[data-testid="edit-quantity-btn"]')
  await page.fill('[name="quantity"]', '150')
  await page.click('button[type="submit"]')

  // Verify
  await expect(page.locator('[data-testid="quantity-display"]')).toHaveText(
    '150'
  )
})
```

## Test Organization

### Directory Structure

```
__tests__/
├── unit/
│   ├── components/     # React component tests
│   ├── lib/           # Utility and library tests
│   └── hooks/         # Custom hook tests
├── integration/
│   ├── actions/       # Server action tests
│   ├── api/          # API route tests
│   └── rls-policies.test.ts
├── e2e/
│   ├── auth/         # Authentication flows
│   ├── inventory/    # Inventory management
│   └── pricing/      # Pricing workflows
├── performance/
│   └── pricing-benchmark.test.ts
└── utils/
    ├── test-utils.tsx # Testing utilities
    └── supabase-mocks.ts
```

### Naming Conventions

- Test files: `*.test.ts` or `*.test.tsx`
- E2E tests: `*.spec.ts`
- Test descriptions: Use descriptive names that explain what is being tested
- Test data: Prefix with `test-` or `mock-`

## Performance Testing

### Running Performance Tests

Performance tests are skipped by default. To run them:

```bash
npm run test:perf
```

### Performance Benchmarks

The pricing engine performance tests check:

- Single price calculation speed
- Batch calculation efficiency
- Concurrent request handling
- Memory usage
- Cache performance

### Performance Targets

- Single price calculation: < 50ms
- Batch calculations: < 2ms per item
- Concurrent requests: > 100 req/s
- Memory usage: < 50MB for 1000 items

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npx playwright install
      - run: npm run test:e2e
```

### Pre-commit Hooks

```bash
# .husky/pre-commit
npm run type-check
npm run lint
npm run test:unit
```

## Troubleshooting

### Common Issues

#### 1. Supabase Connection Errors

```bash
# Ensure environment variables are set
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

#### 2. Jest Configuration Issues

```bash
# Clear Jest cache
jest --clearCache
```

#### 3. Playwright Browser Issues

```bash
# Install required browsers
npx playwright install
```

#### 4. Type Errors in Tests

```bash
# Regenerate types
npm run supabase gen types typescript --local > supabase/types/database.ts
```

### Debugging Tests

#### Debug Jest Tests

```bash
# Run with Node debugger
node --inspect-brk ./node_modules/.bin/jest --runInBand

# VS Code: Use "Jest: Debug" launch configuration
```

#### Debug Playwright Tests

```bash
# Run with debug mode
PWDEBUG=1 npm run test:e2e

# Use Playwright Inspector
npm run test:e2e:ui
```

### Test Coverage

View test coverage report:

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Coverage thresholds are configured in `jest.config.js`:

- Statements: 80%
- Branches: 70%
- Functions: 80%
- Lines: 80%

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Use mocks for Supabase, APIs, etc.
3. **Use Test IDs**: Add `data-testid` attributes for E2E tests
4. **Descriptive Names**: Test names should clearly describe what they test
5. **Arrange-Act-Assert**: Follow the AAA pattern
6. **Test Edge Cases**: Include error scenarios and edge cases
7. **Performance Budget**: Set and test performance targets
8. **Accessibility**: Include accessibility tests in component tests

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
