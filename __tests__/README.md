# TruthSource Component Testing Guide

This directory contains comprehensive React component tests for the TruthSource application. Our testing strategy ensures production-ready components with high reliability and maintainability.

## 🎯 Testing Philosophy

We follow a **comprehensive testing approach** that covers:

- **Functionality**: Core component behavior and user interactions
- **Accessibility**: Screen reader support and keyboard navigation
- **Performance**: Rendering efficiency and memory management
- **Security**: Input validation and data sanitization
- **Edge Cases**: Error handling and boundary conditions
- **Integration**: Component interactions and data flow

## 📁 Test Structure

```
__tests__/
├── helpers/
│   └── test-utils.tsx          # Comprehensive test utilities
├── unit/
│   └── components/
│       ├── ui/                  # UI component tests
│       ├── auth/                # Authentication component tests
│       └── features/            # Feature component tests
│           ├── inventory/       # Inventory management tests
│           ├── analytics/       # Analytics dashboard tests
│           └── monitoring/      # Monitoring component tests
├── integration/                 # Integration tests
├── e2e/                        # End-to-end tests
└── setup.ts                    # Global test configuration
```

## 🚀 Quick Start

### Running Tests

```bash
# Run all component tests
npm run test:unit

# Run specific component type tests
npm run test:ui
npm run test:auth
npm run test:features

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Run performance tests
npm run test:perf
```

### Using the Test Runner Script

```bash
# Run UI component tests
node scripts/run-component-tests.js run ui

# Watch mode with coverage
node scripts/run-component-tests.js watch features --coverage

# CI mode (all tests with strict coverage)
node scripts/run-component-tests.js ci

# Performance testing
node scripts/run-component-tests.js performance all

# Accessibility testing
node scripts/run-component-tests.js accessibility all
```

## 🛠️ Test Utilities

Our `test-utils.tsx` provides comprehensive testing infrastructure:

### Custom Render Function

```typescript
import { render, screen } from '@/__tests__/helpers/test-utils'

// Automatically includes all necessary providers:
// - QueryClient (React Query)
// - ThemeProvider (Next.js themes)
// - Toaster (Notifications)
// - User event setup
```

### Mock Data Factories

```typescript
import { 
  mockUser, 
  mockInventoryItem, 
  mockProduct,
  mockOrder,
  mockCustomer,
  mockPricingRule,
  mockWarehouse,
  mockAuditLog,
  mockAnalyticsData,
  mockMonitoringData
} from '@/__tests__/helpers/test-utils'
```

### Helper Functions

```typescript
import { 
  waitForLoadingToFinish,
  mockServerAction,
  createMockSupabaseClient
} from '@/__tests__/helpers/test-utils'
```

## 📋 Test Categories

### 1. UI Components (`ui/`)

**Components**: Button, Input, Form, Modal, etc.

**Test Coverage**:
- All variants and sizes
- State management (loading, disabled, error)
- Accessibility (ARIA labels, keyboard navigation)
- Event handling and callbacks
- Visual styling and responsive design

**Example**:
```typescript
describe('Button Component', () => {
  describe('Variants', () => {
    it('renders default variant', () => {
      render(<Button variant="default">Click me</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-primary')
    })
  })
})
```

### 2. Authentication Components (`auth/`)

**Components**: LoginForm, SignupForm, ResetPassword, etc.

**Test Coverage**:
- Form validation and error handling
- Server action integration
- Security (input sanitization, no sensitive data logging)
- Loading states and user feedback
- Accessibility compliance

**Example**:
```typescript
describe('LoginForm Component', () => {
  it('validates email format', async () => {
    const { user } = render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'invalid-email')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
  })
})
```

### 3. Feature Components (`features/`)

**Components**: InventoryTable, MetricsCards, AlertHealthMonitor, etc.

**Test Coverage**:
- Data display and calculations
- Real-time updates and state management
- User interactions (sorting, filtering, pagination)
- Performance with large datasets
- Integration with external APIs

**Example**:
```typescript
describe('InventoryTable Component', () => {
  it('filters data when searching', async () => {
    const { user } = render(<InventoryTable data={mockData} />)
    await user.type(screen.getByPlaceholderText(/search/i), 'SKU-001')
    expect(screen.getByText('SKU-001')).toBeInTheDocument()
    expect(screen.queryByText('SKU-002')).not.toBeInTheDocument()
  })
})
```

## 🎨 Testing Patterns

### 1. Component Rendering Tests

```typescript
describe('Rendering', () => {
  it('renders with default props', () => {
    render(<Component />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
```

### 2. User Interaction Tests

```typescript
describe('User Interaction', () => {
  it('handles user input correctly', async () => {
    const { user } = render(<Component />)
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
  })
})
```

### 3. Accessibility Tests

```typescript
describe('Accessibility', () => {
  it('supports keyboard navigation', async () => {
    const { user } = render(<Component />)
    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
  })
})
```

### 4. Performance Tests

```typescript
describe('Performance', () => {
  it('renders large datasets efficiently', () => {
    const startTime = performance.now()
    render(<Component data={largeDataset} />)
    const endTime = performance.now()
    expect(endTime - startTime).toBeLessThan(100)
  })
})
```

### 5. Security Tests

```typescript
describe('Security', () => {
  it('sanitizes user input', async () => {
    const { user } = render(<Component />)
    await user.type(screen.getByLabelText(/input/i), '<script>alert("xss")</script>')
    // Verify input is properly handled
  })
})
```

## 🔧 Mocking Strategy

### Server Actions

```typescript
jest.mock('@/app/actions/auth', () => ({
  signIn: jest.fn().mockResolvedValue({ success: true }),
  signUp: jest.fn().mockResolvedValue({ success: true }),
}))
```

### Supabase Client

```typescript
jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => ({
    auth: { getUser: jest.fn() },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ single: jest.fn() })),
      })),
    })),
  }),
}))
```

### Next.js Router

```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}))
```

## 📊 Coverage Requirements

Our testing strategy requires:

- **Statements**: 80% minimum
- **Branches**: 70% minimum  
- **Functions**: 80% minimum
- **Lines**: 80% minimum

### Coverage Categories

1. **Critical Paths**: 95% coverage
2. **Error Handling**: 90% coverage
3. **User Interactions**: 85% coverage
4. **Edge Cases**: 75% coverage

## 🚨 Error Handling

### Test Failure Categories

1. **Critical Failures**: Break the build
   - Authentication flows
   - Data persistence
   - Security validations

2. **Warning Failures**: Log but don't break
   - Performance thresholds
   - Accessibility warnings
   - Deprecated patterns

3. **Info Failures**: Report only
   - Code style issues
   - Documentation gaps
   - Test coverage gaps

## 🔍 Debugging Tests

### Common Issues

1. **Async Operations**: Use `waitFor` for async state changes
2. **Mock Dependencies**: Ensure all external dependencies are mocked
3. **Component State**: Test state changes with user interactions
4. **Memory Leaks**: Check for proper cleanup in `afterEach`

### Debug Commands

```bash
# Run specific test with verbose output
npm test -- --verbose --testNamePattern="Button.*variant"

# Debug mode with open handles detection
npm test -- --detectOpenHandles --forceExit

# Run tests with coverage for specific file
npm test -- --coverage --collectCoverageFrom="components/ui/button.tsx"
```

## 📈 Performance Testing

### Metrics We Track

1. **Render Time**: < 50ms for simple components
2. **Memory Usage**: No memory leaks after unmount
3. **Bundle Size**: Component size impact
4. **Interaction Responsiveness**: < 16ms for user interactions

### Performance Test Examples

```typescript
describe('Performance', () => {
  it('renders efficiently with large datasets', () => {
    const startTime = performance.now()
    render(<Component data={largeDataset} />)
    const endTime = performance.now()
    expect(endTime - startTime).toBeLessThan(100)
  })
})
```

## ♿ Accessibility Testing

### WCAG 2.1 AA Compliance

1. **Keyboard Navigation**: All interactive elements accessible
2. **Screen Reader Support**: Proper ARIA labels and roles
3. **Color Contrast**: Meets WCAG contrast requirements
4. **Focus Management**: Logical tab order and focus indicators

### Accessibility Test Examples

```typescript
describe('Accessibility', () => {
  it('has proper ARIA attributes', () => {
    render(<Component />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label')
  })
})
```

## 🔒 Security Testing

### Security Considerations

1. **Input Validation**: All user inputs validated
2. **XSS Prevention**: No script injection vulnerabilities
3. **Data Sanitization**: Sensitive data not logged
4. **Authentication**: Proper auth state management

### Security Test Examples

```typescript
describe('Security', () => {
  it('does not log sensitive information', () => {
    const consoleSpy = jest.spyOn(console, 'log')
    // Perform action with sensitive data
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('password')
    )
  })
})
```

## 🎯 Best Practices

### 1. Test Organization

- Group related tests in `describe` blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Test Data

- Use factory functions for consistent test data
- Avoid hardcoded values in tests
- Mock external dependencies consistently

### 3. Assertions

- Test one thing per test case
- Use specific assertions over generic ones
- Include both positive and negative test cases

### 4. Async Testing

- Use `waitFor` for async operations
- Mock timers when testing timeouts
- Handle loading states properly

## 📝 Contributing

### Adding New Tests

1. **Follow the existing structure**
2. **Use the provided test utilities**
3. **Include all test categories** (rendering, interaction, accessibility, performance, security)
4. **Add proper TypeScript types**
5. **Update this documentation**

### Test Review Checklist

- [ ] All user interactions tested
- [ ] Error states covered
- [ ] Accessibility requirements met
- [ ] Performance benchmarks included
- [ ] Security considerations addressed
- [ ] Edge cases handled
- [ ] Integration points tested

## 🔗 Related Documentation

- [Jest Testing Framework](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [TruthSource Architecture](ARCHITECTURE.md)
- [Component Development Guide](COMPONENT-GUIDE.md)

---

**Remember**: Good tests are the foundation of reliable software. Invest time in writing comprehensive, maintainable tests that will catch regressions and ensure your components work correctly in production.
