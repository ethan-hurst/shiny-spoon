# Shopify Integration Tests

This directory contains comprehensive tests for the Shopify B2B integration (PRP-014), including unit tests, integration tests, and end-to-end tests.

## Test Structure

```
__tests__/
├── setup.ts                           # Test environment setup
├── integrations/
│   └── shopify/
│       ├── auth.test.ts              # Unit tests for ShopifyAuth
│       ├── api-client.test.ts        # Unit tests for ShopifyApiClient
│       ├── transformers.test.ts      # Unit tests for ShopifyTransformers
│       ├── connector.test.ts         # Integration tests for ShopifyConnector
│       └── webhook.test.ts           # Integration tests for webhook handler
└── e2e/
    └── shopify-integration.test.ts   # End-to-end tests for complete flow
```

## Test Categories

### Unit Tests
- **`auth.test.ts`**: Tests the `ShopifyAuth` class for authentication, credential validation, and API request handling
- **`api-client.test.ts`**: Tests the `ShopifyApiClient` class for REST and GraphQL API interactions
- **`transformers.test.ts`**: Tests the `ShopifyTransformers` class for data transformation between Shopify and internal formats

### Integration Tests
- **`connector.test.ts`**: Tests the `ShopifyConnector` class for complete integration flow including sync operations and webhook handling
- **`webhook.test.ts`**: Tests the webhook handler API route for signature verification and payload processing

### End-to-End Tests
- **`shopify-integration.test.ts`**: Tests the complete user flow from UI configuration to data synchronization

## Running Tests

### All Tests
```bash
npm test
```

### Shopify Integration Tests Only
```bash
npm run test:shopify
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### End-to-End Tests Only
```bash
npm run test:e2e
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

### UI Mode
```bash
npm run test:ui
```

## Test Configuration

The tests use **Vitest** as the test runner with the following configuration:

- **Environment**: `jsdom` for DOM testing
- **Setup**: `__tests__/setup.ts` for global mocks and configuration
- **Coverage**: V8 provider with HTML, JSON, and text reporters
- **Aliases**: Configured for `@/` imports

## Mocking Strategy

### External Dependencies
- **Supabase**: Mocked client for database operations
- **Next.js**: Mocked router, headers, and navigation
- **Fetch API**: Mocked for HTTP requests
- **Crypto**: Mocked for webhook signature verification

### Internal Dependencies
- **ShopifyAuth**: Mocked for authentication tests
- **ShopifyApiClient**: Mocked for API interaction tests
- **ShopifyTransformers**: Mocked for data transformation tests

## Test Coverage

The tests cover the following areas:

### Authentication & Authorization
- ✅ Credential validation
- ✅ API key authentication
- ✅ Connection testing
- ✅ Error handling for invalid credentials

### API Interactions
- ✅ REST API calls (products, inventory, customers, orders)
- ✅ GraphQL API calls
- ✅ Pagination handling
- ✅ Rate limiting
- ✅ Error responses

### Data Transformation
- ✅ Shopify → Internal format conversion
- ✅ Internal → Shopify format conversion
- ✅ Field mappings
- ✅ Location mappings
- ✅ Weight unit conversions
- ✅ B2B-specific transformations

### Webhook Processing
- ✅ HMAC signature verification
- ✅ Payload parsing and validation
- ✅ Event logging
- ✅ Error handling
- ✅ Multiple webhook topics

### UI Integration
- ✅ Configuration form
- ✅ Connection testing
- ✅ Data synchronization
- ✅ Error display
- ✅ Loading states

### End-to-End Flows
- ✅ Complete integration setup
- ✅ Data synchronization
- ✅ Webhook processing
- ✅ Error scenarios
- ✅ Configuration validation

## Test Data

The tests use realistic mock data that matches Shopify's API response formats:

### Products
```typescript
{
  id: 123456789,
  title: 'Test Product',
  status: 'active',
  variants: [...],
  images: [...],
  options: [...]
}
```

### Inventory
```typescript
{
  id: 111222333,
  inventory_item_id: 555666777,
  location_id: 1,
  available: 25
}
```

### Customers
```typescript
{
  id: 123456789,
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  company: {...}
}
```

### Orders
```typescript
{
  id: 123456789,
  name: '#1001',
  total_price: '100.00',
  financial_status: 'paid',
  line_items: [...]
}
```

## Best Practices

### Test Organization
- Each test file focuses on a single component or feature
- Tests are organized by functionality (auth, API, transformers, etc.)
- Clear test descriptions that explain the expected behavior

### Mocking
- External dependencies are mocked to isolate the code under test
- Mock data is realistic and matches actual API responses
- Mocks are reset between tests to prevent interference

### Error Handling
- Tests cover both success and failure scenarios
- Error messages are validated
- Rate limiting and authentication errors are tested

### Async Operations
- All async operations are properly awaited
- Timeouts are used for long-running operations
- Promise rejections are tested

## Debugging Tests

### Running Individual Tests
```bash
# Run a specific test file
npm test auth.test.ts

# Run a specific test
npm test -- --grep "should authenticate successfully"
```

### Debug Mode
```bash
# Run tests in debug mode
npm test -- --debug
```

### Verbose Output
```bash
# Run tests with verbose output
npm test -- --reporter=verbose
```

## Continuous Integration

The tests are designed to run in CI/CD pipelines:

- **Fast execution**: Tests complete in under 30 seconds
- **No external dependencies**: All external services are mocked
- **Deterministic**: Tests produce consistent results
- **Coverage reporting**: Generates coverage reports for CI

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Use realistic mock data that matches the actual API
3. Test both success and failure scenarios
4. Add appropriate error handling tests
5. Update this README if adding new test categories