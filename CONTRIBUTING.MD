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
- [Issue Guidelines](#issue-guidelines)
- [Documentation](#documentation)
- [Recognition](#recognition)

## 🤝 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our Code of Conduct:

- **Be Respectful**: Treat everyone with respect. No harassment, discrimination, or inappropriate behavior.
- **Be Collaborative**: Work together to resolve conflicts, assume good intentions.
- **Be Professional**: Keep discussions focused on the project and constructive.
- **Be Inclusive**: Welcome newcomers and help them get started.

Violations should be reported to: conduct@truthsource.io

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- PostgreSQL 14+ running locally
- Redis 6+ for caching
- Git configured with your GitHub account
- Your favorite code editor (we recommend VS Code)

### Understanding TruthSource

Before diving into code:
1. Read the [README.md](README.md) for project overview
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
3. Check [.ai/context.md](.ai/context.md) for coding patterns
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
# Install Node dependencies
npm install

# Install pre-commit hooks
npm run prepare
```

### 3. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your local settings:
# DATABASE_URL=postgresql://user:pass@localhost:5432/truthsource_dev
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=local-development-secret
```

### 4. Database Setup

```bash
# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

### 5. Start Development Server

```bash
# Start all services
npm run dev

# Or start services individually:
npm run dev:api    # API server only
npm run dev:web    # Web dashboard only
npm run dev:worker # Background workers only
```

### 6. Verify Setup

```bash
# Run tests to ensure everything works
npm test

# Check the API
curl http://localhost:3000/health

# Access the dashboard
open http://localhost:3001
```

## 🤔 How to Contribute

### Finding Something to Work On

1. **Good First Issues**: Look for issues labeled [`good first issue`](https://github.com/truthsource/truthsource/labels/good%20first%20issue)
2. **Help Wanted**: Check [`help wanted`](https://github.com/truthsource/truthsource/labels/help%20wanted) labels
3. **Documentation**: Always needed and appreciated
4. **Tests**: Improve test coverage
5. **Performance**: Profile and optimize slow code

### Before Starting Work

1. **Check Existing PRs**: Ensure nobody else is working on it
2. **Comment on Issue**: Say "I'd like to work on this"
3. **Ask Questions**: If unclear, ask in the issue or Discord
4. **Propose Solution**: For complex issues, outline your approach first

## 📝 Coding Standards

### TypeScript Style Guide

```typescript
// ✅ DO: Use explicit types
interface InventoryItem {
  sku: string;
  quantity: number;
  lastUpdated: Date;
}

// ❌ DON'T: Use 'any' type
const processData = (data: any) => { }

// ✅ DO: Use async/await
async function fetchInventory(sku: string): Promise<InventoryItem> {
  const result = await db.query('SELECT * FROM inventory WHERE sku = $1', [sku]);
  return result.rows[0];
}

// ❌ DON'T: Use callbacks
function fetchInventory(sku: string, callback: Function) { }

// ✅ DO: Handle errors explicitly
try {
  const inventory = await fetchInventory(sku);
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle specific error
  }
  throw error;
}

// ✅ DO: Use meaningful variable names
const customerSpecificPrice = calculateCustomerPrice(basePrice, customerTier);

// ❌ DON'T: Use single letters or abbreviations
const p = calc(b, t);
```

### Code Organization

```
src/
├── modules/           # Feature modules
│   ├── inventory/
│   │   ├── inventory.controller.ts
│   │   ├── inventory.service.ts
│   │   ├── inventory.module.ts
│   │   └── inventory.spec.ts
│   └── pricing/
├── common/           # Shared code
│   ├── guards/
│   ├── interceptors/
│   └── utils/
└── integrations/     # External system integrations
```

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Examples:
```
feat(inventory): add bulk update endpoint

- Implement POST /api/v1/inventory/bulk-update
- Add validation for up to 1000 items
- Include transaction support for atomicity

Closes #123

---

fix(sync): handle NetSuite timeout errors

Circuit breaker now properly activates after 3 consecutive
timeouts. Previously it would retry indefinitely.

---

docs(api): update pricing endpoint examples

Added customer-specific pricing examples to API docs
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

## 🧪 Testing Requirements

### Test Coverage Standards
- Minimum 80% code coverage
- 100% coverage for critical business logic
- All API endpoints must have integration tests
- All bug fixes must include regression tests

### Writing Tests

```typescript
// Unit Test Example
describe('InventoryService', () => {
  let service: InventoryService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    service = new InventoryService(mockDb);
  });

  describe('checkAvailability', () => {
    it('should return true when inventory is available', async () => {
      // Arrange
      const sku = 'WIDGET-001';
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ quantity: 100 }] 
      });

      // Act
      const available = await service.checkAvailability(sku, 50);

      // Assert
      expect(available).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT quantity'),
        [sku]
      );
    });

    it('should throw NotFoundError for invalid SKU', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(service.checkAvailability('INVALID', 1))
        .rejects.toThrow(NotFoundError);
    });
  });
});

// Integration Test Example
describe('POST /api/v1/inventory/bulk-check', () => {
  it('should validate multiple SKUs', async () => {
    // Arrange
    const skus = ['WIDGET-001', 'GADGET-002'];
    
    // Act
    const response = await request(app)
      .post('/api/v1/inventory/bulk-check')
      .set('Authorization', 'Bearer test-token')
      .send({ skus });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toMatchObject({
      sku: 'WIDGET-001',
      available: expect.any(Number),
      errors: []
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test inventory.service.spec.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```

## 🔄 Pull Request Process

### 1. Create Feature Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feat/add-bulk-pricing-update
```

### 2. Make Your Changes

- Write code following our standards
- Add/update tests
- Update documentation
- Run linter: `npm run lint`
- Run tests: `npm test`

### 3. Commit Your Changes

```bash
# Stage changes
git add .

# Commit with conventional format
git commit -m "feat(pricing): add bulk pricing update endpoint"
```

### 4. Push and Create PR

```bash
# Push to your fork
git push origin feat/add-bulk-pricing-update

# Create PR on GitHub
```

### 5. PR Template

Your PR should include:

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added/updated
- [ ] All tests passing
```

### 6. PR Review Process

1. **Automated Checks**: CI/CD runs tests, linting, security scans
2. **Code Review**: At least one maintainer reviews
3. **Address Feedback**: Make requested changes
4. **Approval**: Maintainer approves
5. **Merge**: Maintainer merges to main

## 📋 Issue Guidelines

### Reporting Bugs

Use the bug report template:

```markdown
**Describe the bug**
Clear description of the problem

**To Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What should happen

**Screenshots**
If applicable

**Environment:**
- OS: [e.g. Ubuntu 20.04]
- Node version: [e.g. 18.16.0]
- Browser: [e.g. Chrome 91]
```

### Requesting Features

Use the feature request template:

```markdown
**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should it work?

**Alternatives Considered**
Other approaches?

**Additional Context**
Mockups, examples, etc.
```

## 📚 Documentation

### Where to Add Documentation

- **API Changes**: Update `docs/technical/api-specification.md`
- **New Features**: Add to `docs/product/features/`
- **Architecture Changes**: Update `ARCHITECTURE.md`
- **Integration Guides**: Add to `docs/workflows/integration-guides/`

### Documentation Standards

```markdown
# Feature Name

## Overview
Brief description of what this does

## Usage
How to use this feature

## Examples
```typescript
// Code examples with comments
const example = await truthsource.doSomething();
```

## Configuration
Any settings or options

## Troubleshooting
Common issues and solutions
```

## 🏆 Recognition

We believe in recognizing our contributors!

### Contributor Levels

- **Contributor**: 1+ merged PRs
- **Regular Contributor**: 5+ merged PRs
- **Core Contributor**: 10+ merged PRs + consistent participation
- **Maintainer**: Invited based on sustained high-quality contributions

### Benefits

- Listed in our [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Special Discord role
- Early access to new features
- Invitation to contributor meetings
- TruthSource swag (for significant contributions)

## 💬 Getting Help

- **Discord**: Join our [Discord server](https://discord.gg/truthsource)
- **Documentation**: Check [docs/](docs/) folder
- **Issues**: Ask questions in GitHub issues
- **Email**: dev@truthsource.io for sensitive matters

## 🔐 Security

If you discover a security vulnerability:
1. **DO NOT** open a public issue
2. Email security@truthsource.io
3. Include steps to reproduce
4. Allow 48 hours for initial response

See [SECURITY.md](SECURITY.md) for full details.

---

## Quick Commands Reference

```bash
# Development
npm run dev           # Start development server
npm run build         # Build for production
npm run lint          # Run linter
npm run lint:fix      # Fix linting issues

# Testing
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:int      # Integration tests only
npm run test:e2e      # End-to-end tests
npm run test:coverage # Generate coverage report

# Database
npm run db:migrate    # Run migrations
npm run db:rollback   # Rollback migration
npm run db:seed       # Seed dev data
npm run db:reset      # Reset database

# Code Quality
npm run typecheck     # TypeScript type checking
npm run format        # Format code with Prettier
npm run analyze       # Bundle size analysis
```

---

Thank you for contributing to TruthSource! Together, we're building the single source of truth for B2B commerce. 🚀
