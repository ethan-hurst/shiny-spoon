#!/bin/bash

# Audit Trail Test Runner
# This script runs the comprehensive test suite for the PRP-020 Audit Trail implementation

set -e  # Exit on any error

echo "🔍 Running Audit Trail Test Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required dependencies are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is required but not installed"
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        print_warning "psql not found - database tests will be skipped"
        SKIP_DB_TESTS=true
    fi
    
    print_success "Dependencies check complete"
}

# Setup test environment
setup_test_env() {
    print_status "Setting up test environment..."
    
    # Create test results directory
    mkdir -p test-results
    
    # Copy environment variables for testing
    if [ -f .env.local ]; then
        cp .env.local .env.test
        print_success "Test environment configured"
    else
        print_warning "No .env.local found - using default test configuration"
    fi
}

# Run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    
    npx jest --config jest.config.audit.js --selectProjects unit --coverage --verbose
    
    if [ $? -eq 0 ]; then
        print_success "Unit tests passed"
    else
        print_error "Unit tests failed"
        exit 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    # Start test database if needed
    if [ "$SKIP_DB_TESTS" != "true" ]; then
        print_status "Starting test database..."
        # Add database setup commands here if needed
    fi
    
    npx jest --config jest.config.audit.js --selectProjects integration --verbose
    
    if [ $? -eq 0 ]; then
        print_success "Integration tests passed"
    else
        print_error "Integration tests failed"
        exit 1
    fi
}

# Run database tests
run_database_tests() {
    if [ "$SKIP_DB_TESTS" = "true" ]; then
        print_warning "Skipping database tests (psql not available)"
        return 0
    fi
    
    print_status "Running database tests..."
    
    # Check if test database exists
    if psql -lqt | cut -d \| -f 1 | grep -qw audit_test_db; then
        print_status "Using existing test database"
    else
        print_status "Creating test database..."
        createdb audit_test_db
    fi
    
    # Run database schema tests
    psql -d audit_test_db -f __tests__/database/audit-trail.test.sql > test-results/database-test-output.log 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "Database tests passed"
    else
        print_error "Database tests failed"
        cat test-results/database-test-output.log
        exit 1
    fi
}

# Run end-to-end tests
run_e2e_tests() {
    print_status "Running end-to-end tests..."
    
    # Install Playwright browsers if needed
    if [ ! -d "node_modules/@playwright/test" ]; then
        print_status "Installing Playwright..."
        npx playwright install
    fi
    
    # Run Playwright tests
    npx playwright test __tests__/e2e/audit-trail.spec.ts --reporter=html
    
    if [ $? -eq 0 ]; then
        print_success "End-to-end tests passed"
    else
        print_error "End-to-end tests failed"
        print_status "Check test-results/playwright-report for details"
        exit 1
    fi
}

# Generate test report
generate_report() {
    print_status "Generating test report..."
    
    # Create comprehensive test report
    cat > test-results/audit-trail-test-report.md << EOF
# Audit Trail Test Report
Generated: $(date)

## Test Summary

### Unit Tests
- **Status**: ✅ Passed
- **Coverage**: See coverage/ directory
- **Files Tested**:
  - AuditLogger service
  - Server actions
  - Utility functions

### Integration Tests
- **Status**: ✅ Passed
- **Scenarios Tested**:
  - End-to-end audit logging workflow
  - Bulk operations
  - Export functionality
  - Compliance report generation
  - Concurrent operations
  - Error handling
  - Retention policies

### Database Tests
$(if [ "$SKIP_DB_TESTS" = "true" ]; then echo "- **Status**: ⚠️ Skipped (psql not available)"; else echo "- **Status**: ✅ Passed"; fi)
- **Schema Validation**: Table structure, constraints, indexes
- **RLS Policies**: Organization isolation, role-based access
- **Performance**: Query optimization with indexes
- **Data Integrity**: Foreign keys, JSON handling

### End-to-End Tests
- **Status**: ✅ Passed
- **Browser Testing**: Audit trail UI functionality
- **User Interactions**: Filtering, pagination, export
- **Access Control**: Role-based feature visibility

## Coverage Report
See \`coverage/lcov-report/index.html\` for detailed coverage information.

## Performance Metrics
- High-volume logging: < 30ms average per operation
- Query performance: < 1 second for filtered queries
- Export generation: < 5 seconds for standard datasets

## Compliance Validation
- ✅ SOC 2 compliance report generation
- ✅ ISO 27001 compliance report generation
- ✅ Data retention policy enforcement
- ✅ Audit trail completeness

## Files Tested
\`\`\`
lib/audit/audit-logger.ts
app/actions/audit.ts
components/features/audit/
app/(dashboard)/audit/
supabase/migrations/20250128_audit_trail.sql
\`\`\`

## Next Steps
1. Monitor audit trail performance in production
2. Regular compliance report reviews
3. Retention policy optimization based on usage patterns
EOF

    print_success "Test report generated: test-results/audit-trail-test-report.md"
}

# Cleanup test environment
cleanup() {
    print_status "Cleaning up test environment..."
    
    # Remove test environment file
    if [ -f .env.test ]; then
        rm .env.test
    fi
    
    # Clean up test database if created
    if [ "$SKIP_DB_TESTS" != "true" ] && psql -lqt | cut -d \| -f 1 | grep -qw audit_test_db; then
        print_status "Cleaning up test database..."
        dropdb audit_test_db --if-exists
    fi
    
    print_success "Cleanup complete"
}

# Main execution
main() {
    echo "Starting Audit Trail comprehensive test suite..."
    echo "Test started at: $(date)"
    
    # Trap cleanup on exit
    trap cleanup EXIT
    
    check_dependencies
    setup_test_env
    
    # Run tests in order
    print_status "Running test suite..."
    run_unit_tests
    run_integration_tests
    run_database_tests
    run_e2e_tests
    
    # Generate final report
    generate_report
    
    print_success "🎉 All audit trail tests completed successfully!"
    print_status "Test completed at: $(date)"
    
    # Show summary
    echo ""
    echo "📊 Test Results Summary:"
    echo "========================"
    echo "✅ Unit Tests: PASSED"
    echo "✅ Integration Tests: PASSED"
    if [ "$SKIP_DB_TESTS" = "true" ]; then
        echo "⚠️  Database Tests: SKIPPED"
    else
        echo "✅ Database Tests: PASSED"
    fi
    echo "✅ End-to-End Tests: PASSED"
    echo ""
    echo "📁 Reports available in: test-results/"
    echo "🌐 Coverage report: coverage/lcov-report/index.html"
    echo "🎭 E2E report: test-results/playwright-report/index.html"
}

# Handle script arguments
case "${1:-all}" in
    "unit")
        check_dependencies
        setup_test_env
        run_unit_tests
        ;;
    "integration")
        check_dependencies
        setup_test_env
        run_integration_tests
        ;;
    "database")
        check_dependencies
        setup_test_env
        run_database_tests
        ;;
    "e2e")
        check_dependencies
        setup_test_env
        run_e2e_tests
        ;;
    "all"|*)
        main
        ;;
esac