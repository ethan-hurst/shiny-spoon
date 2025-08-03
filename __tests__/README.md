# Audit Trail Test Suite

This comprehensive test suite validates the implementation of **PRP-020: Audit Trail & Compliance**. The tests ensure that the audit logging system meets all compliance requirements and performs reliably under various conditions.

## Test Structure

```
__tests__/
├── lib/audit/                    # Unit tests for audit logging service
│   └── audit-logger.test.ts     # AuditLogger class tests
├── app/actions/                  # Server action tests
│   └── audit.test.ts             # Export and compliance report tests
├── integration/                  # End-to-end workflow tests
│   └── audit-workflow.test.ts    # Complete audit trail integration
├── e2e/                         # Browser-based UI tests
│   └── audit-trail.spec.ts      # Playwright tests for audit UI
├── database/                    # Database schema and policy tests
│   └── audit-trail.test.sql     # SQL-based database validation
├── setup.ts                    # Global test configuration
└── README.md                   # This file
```

## Test Categories

### 1. Unit Tests (`lib/audit/`)

Tests the core `AuditLogger` service with comprehensive coverage:

- **Basic Logging**: Create, update, delete, view operations
- **Helper Methods**: Convenience methods for common actions
- **Error Handling**: Graceful failure and recovery
- **Context Extraction**: IP address, user agent, headers
- **Wrapper Functions**: `withAuditLog` decorator testing
- **Data Validation**: Input sanitization and type checking

**Coverage Target**: 90% for audit logging core

### 2. Server Action Tests (`app/actions/`)

Validates server-side audit functionality:

- **Export Functions**: CSV and JSON export with filtering
- **Compliance Reports**: SOC 2, ISO 27001, custom reports
- **Authentication**: User authorization and access control
- **Error Scenarios**: Network failures, invalid data
- **Performance**: Export speed and memory usage

### 3. Integration Tests (`integration/`)

End-to-end workflow validation:

- **Complete Audit Trail**: Create → Update → Delete with logging
- **Bulk Operations**: High-volume audit logging efficiency
- **Concurrent Operations**: Multi-user audit integrity
- **Retention Policies**: Automatic cleanup and data retention
- **Transaction Safety**: Audit logging within database transactions
- **Performance Testing**: Scalability under load

### 4. End-to-End Tests (`e2e/`)

Browser-based UI testing with Playwright:

- **Audit Table Display**: Data presentation and formatting
- **Filtering System**: Date ranges, users, actions, entities
- **Export Features**: Download CSV/JSON files
- **Pagination**: Large dataset navigation
- **Access Control**: Role-based feature visibility
- **User Interactions**: Clicks, form submissions, navigation

### 5. Database Tests (`database/`)

SQL-based schema and policy validation:

- **Table Structure**: Columns, constraints, indexes
- **Row Level Security**: Organization isolation policies
- **Performance Indexes**: Query optimization validation
- **Data Integrity**: Foreign keys, JSON handling
- **Retention Cleanup**: Automated log purging
- **Extension Support**: supa_audit integration

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Install test-specific packages
npm install --save-dev jest @jest/globals @testing-library/jest-dom
npm install --save-dev playwright @playwright/test
npm install --save-dev ts-jest jest-junit
```

### Quick Start

```bash
# Run complete test suite
./scripts/test-audit.sh

# Run specific test categories
./scripts/test-audit.sh unit        # Unit tests only
./scripts/test-audit.sh integration # Integration tests only
./scripts/test-audit.sh database    # Database tests only
./scripts/test-audit.sh e2e         # End-to-end tests only
```

### Manual Test Execution

```bash
# Unit tests with coverage
npx jest --config jest.config.audit.js --selectProjects unit --coverage

# Integration tests
npx jest --config jest.config.audit.js --selectProjects integration

# Playwright E2E tests
npx playwright test __tests__/e2e/audit-trail.spec.ts

# Database tests (requires PostgreSQL)
psql -d test_database -f __tests__/database/audit-trail.test.sql
```

## Test Configuration

### Environment Variables

Create `.env.test` with test-specific configuration:

```env
# Test Database
DATABASE_URL=postgresql://user:pass@localhost:5432/audit_test_db

# Supabase Test Configuration
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-key
SUPABASE_SERVICE_ROLE_KEY=test-service-key

# Test Flags
SKIP_DATABASE_TESTS=false
SKIP_E2E_TESTS=false
TEST_TIMEOUT=30000
```

### Jest Configuration

The test suite uses `jest.config.audit.js` with:

- **TypeScript Support**: `ts-jest` transformer
- **Module Mapping**: `@/` path resolution
- **Coverage Thresholds**: 80% global, 90% for audit core
- **Test Projects**: Separate configs for each test type
- **Reporters**: Console + JUnit XML output

### Playwright Configuration

E2E tests use Playwright with:

- **Browser Support**: Chromium, Firefox, Safari
- **Mobile Testing**: Responsive design validation
- **API Mocking**: Controlled test data
- **Screenshots**: Failure capture for debugging

## Test Data Management

### Mock Data

Tests use consistent mock data from `setup.ts`:

```typescript
// Example usage in tests
const mockLog = global.auditTestUtils.createMockAuditLog({
  action: 'create',
  entity_type: 'product',
  user_email: 'test@example.com',
})
```

### Database Seeding

Integration and database tests create isolated test data:

- **Organizations**: Separate test organizations
- **Users**: Test users with different roles
- **Audit Logs**: Controlled test scenarios
- **Cleanup**: Automatic teardown after tests

### Test Isolation

Each test runs in isolation with:

- **Mock Reset**: Cleared between tests
- **Database Transactions**: Rollback after tests
- **Time Mocking**: Consistent timestamps
- **Environment Isolation**: Separate test config

## Coverage and Reporting

### Coverage Targets

| Component         | Target | Current |
| ----------------- | ------ | ------- |
| Audit Logger Core | 90%    | ✅      |
| Server Actions    | 85%    | ✅      |
| UI Components     | 80%    | ✅      |
| Database Schema   | 100%   | ✅      |
| Overall           | 80%    | ✅      |

### Reports Generated

1. **Coverage Report**: `coverage/lcov-report/index.html`
2. **Test Results**: `test-results/audit-trail-test-results.xml`
3. **E2E Report**: `test-results/playwright-report/index.html`
4. **Database Output**: `test-results/database-test-output.log`
5. **Summary Report**: `test-results/audit-trail-test-report.md`

## Compliance Validation

The test suite validates compliance requirements:

### SOC 2 Requirements

- ✅ **Access Control**: User authentication and authorization
- ✅ **Audit Logging**: Complete activity tracking
- ✅ **Data Integrity**: Tamper-evident audit trails
- ✅ **Retention**: Configurable data retention policies
- ✅ **Export**: Compliance report generation

### ISO 27001 Requirements

- ✅ **Information Security**: Secure audit data handling
- ✅ **Access Management**: Role-based access control
- ✅ **Monitoring**: Continuous activity monitoring
- ✅ **Documentation**: Comprehensive audit trails
- ✅ **Risk Management**: Error handling and recovery

### GDPR Considerations

- ✅ **Data Minimization**: Only necessary audit data
- ✅ **Retention Limits**: Automatic data purging
- ✅ **Right to Export**: User data export capability
- ✅ **Data Protection**: Encrypted audit storage

## Performance Benchmarks

Tests validate performance requirements:

- **Single Operation**: < 50ms average
- **Bulk Operations**: < 30ms per operation (1000+ items)
- **Query Performance**: < 1 second for filtered queries
- **Export Generation**: < 5 seconds for standard datasets
- **UI Responsiveness**: < 200ms for user interactions

## Troubleshooting

### Common Issues

1. **Database Connection Errors**

   ```bash
   # Check PostgreSQL is running
   pg_isready

   # Verify test database exists
   psql -l | grep audit_test_db
   ```

2. **Playwright Browser Issues**

   ```bash
   # Reinstall browsers
   npx playwright install --force

   # Run with debug mode
   PWDEBUG=1 npx playwright test
   ```

3. **Coverage Report Missing**

   ```bash
   # Ensure coverage directory exists
   mkdir -p coverage

   # Run with explicit coverage flag
   npx jest --coverage --coverageDirectory=coverage
   ```

### Debug Mode

Enable verbose testing for troubleshooting:

```bash
# Verbose Jest output
DEBUG=true npx jest --verbose

# Playwright debug mode
PWDEBUG=1 npx playwright test --headed

# Database query logging
PGPASSWORD=pass psql -d audit_test_db -e -f test.sql
```

## Contributing

When adding new audit functionality:

1. **Write Tests First**: TDD approach for new features
2. **Update Coverage**: Maintain coverage thresholds
3. **Document Changes**: Update test documentation
4. **Validate Compliance**: Ensure regulatory requirements met
5. **Performance Test**: Validate speed and scalability

### Test Writing Guidelines

- **Descriptive Names**: Clear test intention
- **Isolated Tests**: No dependencies between tests
- **Mock External**: Database, APIs, file system
- **Assert Completely**: Verify all aspects of behavior
- **Clean Up**: Proper test teardown

### Review Checklist

- [ ] All test categories pass
- [ ] Coverage thresholds met
- [ ] Performance benchmarks satisfied
- [ ] Compliance requirements validated
- [ ] Documentation updated
- [ ] No test flakiness

## Related Documentation

- [PRP-020 Specification](../PRPs/Phase%205/PRP-020.md)
- [Audit Logger API](../lib/audit/README.md)
- [Database Schema](../supabase/migrations/20250128_audit_trail.sql)
- [Compliance Reports](../docs/compliance.md)

## Support

For test-related questions:

1. Check existing test files for examples
2. Review error logs in `test-results/`
3. Consult test documentation
4. Verify environment configuration
