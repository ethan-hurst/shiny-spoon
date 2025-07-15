# TruthSource AI Assistant Context

## 🎯 Project Overview

You are working on **TruthSource**, a B2B e-commerce data accuracy platform that prevents costly order errors by synchronizing inventory, pricing, and delivery data between ERPs (NetSuite, SAP, Dynamics) and e-commerce platforms (Shopify B2B, BigCommerce).

**Core Problem**: 33% of B2B e-commerce orders contain errors, costing distributors an average of $400,000 annually in lost revenue, returns, and customer churn.

**Our Solution**: Real-time, bidirectional data synchronization with 99.9% accuracy guarantee.

## 📋 Project Awareness & Context

### Critical Files to Read First
1. **`README.md`** - Project overview and quick start guide
2. **`ARCHITECTURE.md`** - High-level system design and decisions
3. **`.ai/context.md`** - Detailed coding patterns, anti-patterns, and constraints
4. **`docs/technical/api-specification.md`** - Complete API reference with examples
5. **`docs/product/PRD.md`** - Product requirements and user stories
6. **`CONTRIBUTING.md`** - Development workflow and standards

### Before Starting Any Task
- **Check `TASK.md`** for current sprint tasks and priorities
- **Review recent commits** to understand current work
- **Check open PRs** to avoid duplicate work
- **Read relevant integration guides** in `docs/workflows/integration-guides/`

## 🏗 Architecture & Technical Constraints

### Core Architecture Principles
1. **Data Accuracy Over Speed** - Never show incorrect data, even if it means showing a loading state
2. **Multi-Tenant Isolation** - ALWAYS filter by `customerId` in every database query
3. **Async Processing** - NEVER make synchronous external API calls in request handlers
4. **Defensive Programming** - Validate ALL external data before storing
5. **Comprehensive Audit Trail** - Log all data changes but NEVER log sensitive data

### Performance Requirements
- **API Response Time**: <200ms for reads, <500ms for writes
- **Sync Latency**: <30 seconds end-to-end
- **Throughput**: 10,000 requests/second
- **Data Volume**: 5,000-100,000 SKUs per customer
- **Uptime SLA**: 99.9% (43 minutes downtime/month maximum)

### Security Requirements
- **SOC2 Type II** compliance required
- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Authentication**: JWT tokens (1-hour expiry)
- **API Keys**: Environment-prefixed (`ts_live_`, `ts_test_`)
- **PII Handling**: Never log customer data, mask in non-production

## 💻 Tech Stack & Conventions

### Core Technologies
- **Runtime**: Node.js 18+ (NOT Python - note the discrepancy in original rules)
- **Language**: TypeScript (strict mode enabled)
- **Framework**: NestJS for enterprise architecture
- **Database**: PostgreSQL 14+ with row-level security
- **Cache**: Redis 6+ for session and response caching
- **Queue**: RabbitMQ for async task processing
- **Testing**: Jest with 80% minimum coverage

### Code Structure
```
src/
├── modules/              # Feature modules
│   ├── inventory/
│   │   ├── inventory.controller.ts    # HTTP endpoints
│   │   ├── inventory.service.ts       # Business logic
│   │   ├── inventory.module.ts        # Module definition
│   │   ├── dto/                       # Data transfer objects
│   │   └── __tests__/                 # Module tests
│   └── pricing/
├── common/               # Shared utilities
│   ├── guards/          # Auth, rate limit guards
│   ├── interceptors/    # Logging, metrics
│   └── exceptions/      # Custom exceptions
├── integrations/        # External system connectors
│   ├── netsuite/
│   ├── shopify/
│   └── sap/
└── config/              # Configuration modules
```

### File Size Limits
- **Maximum file length**: 300 lines for services, 200 for controllers
- **Split large files** into focused modules with clear responsibilities
- **Extract complex business logic** into separate service files

## 🎨 Coding Standards

### TypeScript Patterns

```typescript
// ✅ ALWAYS use explicit types and interfaces
interface InventoryUpdateDto {
  sku: string;
  quantity: number;
  warehouseId: string;
  reason: 'sale' | 'return' | 'adjustment' | 'transfer';
}

// ✅ ALWAYS use dependency injection
constructor(
  private readonly inventoryService: InventoryService,
  @InjectQueue('sync') private readonly syncQueue: Queue,
  @InjectRedis() private readonly redis: Redis
) {}

// ✅ ALWAYS handle errors explicitly
async updateInventory(dto: InventoryUpdateDto): Promise<InventoryItem> {
  try {
    // Validate business rules
    if (dto.quantity < 0 && dto.reason !== 'adjustment') {
      throw new BadRequestException('Negative quantities only allowed for adjustments');
    }

    // Check cache first
    const cached = await this.redis.get(`inv:${dto.sku}`);
    if (cached) {
      await this.redis.del(`inv:${dto.sku}`); // Invalidate cache
    }

    // Update database
    const result = await this.inventoryService.update(dto);

    // Queue sync to external systems
    await this.syncQueue.add('inventory-update', {
      sku: dto.sku,
      customerId: this.currentUser.customerId,
      timestamp: new Date()
    });

    return result;
  } catch (error) {
    this.logger.error('Inventory update failed', {
      sku: dto.sku,
      customerId: this.currentUser.customerId,
      error: error.message,
      // NEVER log: dto.apiKey, full request body, sensitive data
    });
    throw error;
  }
}

// ❌ NEVER use 'any' type
const processData = (data: any) => {} // BAD!

// ❌ NEVER make sync external calls
const price = await externalApi.getPrice(sku); // BAD in request handler!

// ❌ NEVER forget customerId in queries
const items = await db.query('SELECT * FROM inventory'); // SECURITY RISK!
```

### API Endpoint Pattern
```typescript
@Controller('inventory')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@UseInterceptors(LoggingInterceptor, MetricsInterceptor)
export class InventoryController {
  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update inventory levels' })
  @ApiResponse({ status: 200, description: 'Update successful' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async bulkUpdate(
    @Body() dto: BulkUpdateDto,
    @CurrentUser() user: User
  ): Promise<ApiResponse<BulkUpdateResult>> {
    // Controller only handles HTTP concerns
    const result = await this.inventoryService.bulkUpdate(dto, user.customerId);
    
    return {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };
  }
}
```

### Database Query Pattern
```typescript
// ✅ ALWAYS include customerId and use parameterized queries
const inventory = await this.db.query(
  `SELECT sku, quantity, warehouse_id, last_updated
   FROM inventory
   WHERE customer_id = $1 
     AND sku = ANY($2)
     AND deleted_at IS NULL
   ORDER BY sku`,
  [customerId, skus]
);

// ✅ Use transactions for multi-step operations
async transferInventory(from: string, to: string, sku: string, qty: number) {
  const client = await this.db.getClient();
  try {
    await client.query('BEGIN');
    
    // Deduct from source
    await client.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE warehouse_id = $2 AND sku = $3',
      [qty, from, sku]
    );
    
    // Add to destination
    await client.query(
      'UPDATE inventory SET quantity = quantity + $1 WHERE warehouse_id = $2 AND sku = $3',
      [qty, to, sku]
    );
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## 🧪 Testing Requirements

### Test Structure
```typescript
describe('InventoryService', () => {
  let service: InventoryService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // Setup mocks
    mockDb = createMock<DatabaseService>();
    mockRedis = createMock<Redis>();
    
    // Create service with mocks
    service = new InventoryService(mockDb, mockRedis);
  });

  describe('updateInventory', () => {
    it('should update inventory and invalidate cache', async () => {
      // Arrange
      const dto: InventoryUpdateDto = {
        sku: 'WIDGET-001',
        quantity: 100,
        warehouseId: 'WH-001',
        reason: 'adjustment'
      };
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 1, ...dto }] });

      // Act
      const result = await service.updateInventory(dto, 'CUST-123');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE inventory'),
        expect.arrayContaining(['CUST-123', 'WIDGET-001'])
      );
      expect(mockRedis.del).toHaveBeenCalledWith('inv:WIDGET-001');
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockDb.query.mockRejectedValueOnce(new Error('Connection lost'));

      // Act & Assert
      await expect(service.updateInventory(dto, 'CUST-123'))
        .rejects.toThrow('Connection lost');
    });
  });
});
```

### Testing Checklist
- [ ] Unit tests for all business logic (services)
- [ ] Integration tests for all API endpoints
- [ ] Error cases and edge cases covered
- [ ] External API calls are mocked
- [ ] Database queries are tested
- [ ] Authentication/authorization tested
- [ ] Rate limiting tested
- [ ] 80% minimum code coverage

## 📝 Documentation Requirements

### When to Update Documentation
1. **API Changes**: Update `docs/technical/api-specification.md`
2. **New Features**: Update `README.md` and add to `docs/product/features/`
3. **Integration Changes**: Update relevant guide in `docs/workflows/integration-guides/`
4. **Architecture Changes**: Update `ARCHITECTURE.md`
5. **Breaking Changes**: Update `CHANGELOG.md` with migration guide

### Code Documentation
```typescript
/**
 * Updates inventory levels for a specific SKU
 * 
 * @param dto - Inventory update details
 * @param customerId - Customer ID for multi-tenancy
 * @returns Updated inventory item
 * @throws {BadRequestException} If quantity is invalid
 * @throws {NotFoundException} If SKU doesn't exist
 * 
 * @example
 * const updated = await service.updateInventory({
 *   sku: 'WIDGET-001',
 *   quantity: 100,
 *   warehouseId: 'WH-001',
 *   reason: 'adjustment'
 * }, 'CUST-123');
 */
```

## ✅ Task Management

### Before Starting a Task
1. Check `TASK.md` for task details and acceptance criteria
2. Create a feature branch: `git checkout -b feat/task-description`
3. Review related documentation
4. Check for existing tests that might need updates

### During Development
1. Write tests FIRST (TDD) when possible
2. Commit frequently with conventional commits
3. Update documentation as you go
4. Add discovered tasks to `TASK.md`

### Task Completion Checklist
- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No console.logs or debugging code left
- [ ] Code reviewed against standards
- [ ] `TASK.md` updated with completion date
- [ ] PR created with proper template

## 🚨 Critical Rules - NEVER VIOLATE THESE

1. **NEVER query database without customerId filter** - This is a security breach
2. **NEVER log sensitive data** (API keys, passwords, full request bodies, PII)
3. **NEVER make synchronous external API calls** in request handlers
4. **NEVER trust external data** without validation
5. **NEVER use `any` type** in TypeScript
6. **NEVER commit code without tests**
7. **NEVER store credentials in code** - Use environment variables
8. **NEVER ignore rate limits** on external APIs

## 🤝 AI Behavior Guidelines

### When You're Unsure
- **Ask for clarification** rather than making assumptions
- **Reference the documentation** before suggesting solutions
- **Check existing patterns** in the codebase
- **Propose multiple approaches** with trade-offs

### Code Generation Rules
- **Always follow existing patterns** found in the codebase
- **Generate complete, working code** with proper error handling
- **Include comprehensive tests** with your code
- **Add helpful comments** explaining complex logic
- **Update all affected documentation**

### Common Patterns to Remember
- All endpoints need authentication (except health checks)
- All database queries need customerId filtering
- All external calls need circuit breakers
- All responses follow the standard format
- All errors are properly typed and handled

## 🔍 Quick Reference

### Key Business Context
- **Target Market**: Mid-market distributors ($10M-$100M revenue)
- **Pricing Tiers**: Starter ($499), Professional ($1,499), Enterprise ($3,999+)
- **Main Value Prop**: Reduce order errors from 33% to <1%
- **ROI**: Average customer saves $400k/year

### Important Metrics
- Order Error Rate: Target <1%
- Sync Accuracy: Target 99.9%
- API Response Time: <200ms
- Customer Churn: Target <5% monthly
- Implementation Time: Target <5 days

### Getting Help
- Architecture questions → `ARCHITECTURE.md`
- API details → `docs/technical/api-specification.md`
- Business context → `docs/product/PRD.md`
- Integration guides → `docs/workflows/integration-guides/`
- Coding patterns → `.ai/context.md`

---

**Remember**: You're building a system that handles critical business data worth millions of dollars. Every order error costs real money. When in doubt, choose reliability and accuracy over speed or cleverness. Our customers depend on TruthSource to be their single source of truth.
