# TruthSource Architecture Overview

This document provides a high-level overview of TruthSource's architecture. For detailed technical specifications, see [docs/technical/architecture.md](docs/technical/architecture.md).

## 🎯 Architecture Goals

1. **Data Accuracy**: Maintain 99.9% synchronization accuracy across systems
2. **Real-time Performance**: Sub-30 second end-to-end sync latency
3. **Scalability**: Handle 10,000+ requests/second and 100,000+ SKUs per customer
4. **Reliability**: 99.9% uptime SLA with automatic failover
5. **Security**: SOC2 compliant with end-to-end encryption

## 🏗 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            External Systems                              │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┤
│    NetSuite     │   Shopify B2B   │   SAP B1        │   Dynamics 365  │
│      (ERP)      │  (E-commerce)   │    (ERP)        │     (ERP)       │
└────────┬────────┴────────┬────────┴────────┬────────┴────────┬────────┘
         │                 │                 │                 │
         └─────────────────┴─────────────────┴─────────────────┘
                                    │
                           ┌────────▼────────┐
                           │ TruthSource API │
                           │    Gateway      │
                           └────────┬────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
┌───────▼────────┐       ┌─────────▼─────────┐       ┌────────▼────────┐
│  Sync Engine   │       │  Business Logic   │       │   API Service   │
│                │       │                   │       │                 │
│ • Webhooks     │       │ • Validation      │       │ • REST API      │
│ • Polling      │       │ • Pricing Rules   │       │ • GraphQL       │
│ • Conflict Res │       │ • Inventory Calc  │       │ • Webhooks      │
└────────┬───────┘       └─────────┬─────────┘       └────────┬────────┘
         │                         │                           │
         └─────────────────────────┴───────────────────────────┘
                                    │
                           ┌────────▼────────┐
                           │   Data Layer    │
                           ├─────────────────┤
                           │  PostgreSQL     │
                           │  Redis Cache    │
                           │  Elasticsearch  │
                           └────────┬────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                │                                       │
       ┌────────▼────────┐                   ┌─────────▼─────────┐
       │  Message Queue  │                   │   Monitoring      │
       │   (RabbitMQ)    │                   │ Prometheus/Grafana│
       └─────────────────┘                   └───────────────────┘
```

## 🔧 Core Components

### 1. API Gateway
- **Purpose**: Single entry point for all external requests
- **Technology**: Node.js + Express/NestJS
- **Responsibilities**:
  - Authentication/Authorization
  - Rate limiting
  - Request routing
  - API versioning

### 2. Sync Engine
- **Purpose**: Maintains data consistency across systems
- **Technology**: TypeScript workers + RabbitMQ
- **Key Features**:
  - Webhook listeners for real-time updates
  - Polling fallback for systems without webhooks
  - Conflict resolution based on configurable rules
  - Automatic retry with exponential backoff

### 3. Business Logic Layer
- **Purpose**: Enforces business rules and data validation
- **Technology**: NestJS services
- **Responsibilities**:
  - Customer-specific pricing calculations
  - Inventory buffer management
  - Delivery time predictions
  - Data transformation between systems

### 4. Data Layer
- **Primary Database**: PostgreSQL 14+
  - Multi-tenant with row-level security
  - JSONB for flexible integrations
  - Partitioned tables for audit logs
- **Cache**: Redis 6+
  - Session management
  - API response caching
  - Real-time pub/sub
- **Search**: Elasticsearch
  - Log aggregation
  - Full-text search
  - Analytics queries

### 5. Message Queue
- **Technology**: RabbitMQ
- **Use Cases**:
  - Async processing of sync operations
  - Event broadcasting
  - Task scheduling
  - Dead letter queue for failed operations

## 🔄 Data Flow

### Real-time Sync Flow
```
1. External System → Webhook → API Gateway
2. API Gateway → Validation → Message Queue
3. Worker → Process Change → Update Database
4. Database Trigger → Propagate to Other Systems
5. Update Cache → Notify Subscribers
```

### Batch Sync Flow
```
1. Scheduler → Trigger Batch Job
2. Fetch Data from External System
3. Compare with Current State
4. Generate Change Set
5. Process Changes in Batches
6. Update Systems → Log Results
```

## 🛡 Security Architecture

### Network Security
- All traffic over TLS 1.3
- VPC isolation for internal services
- WAF for API protection
- DDoS protection via CloudFlare

### Application Security
- JWT-based authentication
- API key management with rotation
- Role-based access control (RBAC)
- Input validation at every layer

### Data Security
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- PII data masking in logs
- Audit trail for all operations

## 📊 Scalability Strategy

### Horizontal Scaling
- Stateless API servers behind load balancer
- Multiple sync workers with queue-based distribution
- Read replicas for database queries
- Redis cluster for cache distribution

### Performance Optimization
- Database query optimization with indexes
- Aggressive caching strategy
- CDN for static assets
- Connection pooling for external APIs

### Monitoring & Observability
- Prometheus metrics for all services
- Distributed tracing with OpenTelemetry
- Centralized logging with ELK stack
- Real-time dashboards with Grafana

## 🔌 Integration Patterns

### Webhook Integration
```typescript
POST /webhooks/netsuite/inventory-change
{
  "event": "inventory.updated",
  "timestamp": "2025-07-15T10:30:00Z",
  "data": {
    "sku": "WIDGET-001",
    "quantity": 150
  }
}
```

### Polling Integration
- Configurable intervals (1, 5, 15, 30 minutes)
- Delta detection to minimize processing
- Checksum validation for data integrity

### API Integration
- RESTful endpoints for CRUD operations
- GraphQL for flexible queries
- Batch endpoints for bulk operations

## 🚦 Architectural Decisions

### Why Event-Driven Architecture?
- Decouples systems for better scalability
- Enables real-time processing
- Provides natural audit trail
- Allows for easy replay of events

### Why PostgreSQL?
- ACID compliance for financial data
- Strong consistency guarantees
- Excellent JSON support for flexible schemas
- Mature ecosystem and tooling

### Why Microservices?
- Independent scaling of components
- Technology flexibility per service
- Fault isolation
- Easier team parallelization

### Why Redis?
- Sub-millisecond latency
- Pub/sub for real-time updates
- Data structure variety
- High availability with clustering

## 📈 Performance Characteristics

### Latency Targets
- API Response: <200ms (p99)
- Cache Hit: <5ms
- Database Query: <50ms
- End-to-end Sync: <30s

### Throughput Targets
- API Requests: 10,000/second
- Webhook Processing: 1,000/second
- Batch Processing: 1M records/hour
- Real-time Updates: 100/second/customer

## 🔮 Future Architecture Considerations

### Phase 2 (Months 4-6)
- GraphQL subscriptions for real-time updates
- ML pipeline for anomaly detection
- Multi-region deployment
- Event sourcing for complex workflows

### Phase 3 (Months 7-12)
- Kubernetes for container orchestration
- Service mesh for microservice communication
- Edge computing for global latency reduction
- Blockchain for audit trail integrity

## 📚 Related Documentation

- [Detailed Technical Architecture](docs/technical/architecture.md)
- [API Specification](docs/technical/api-specification.md)
- [Database Schema](docs/technical/database-schema.md)
- [Security Requirements](docs/technical/security-requirements.md)
- [Integration Guides](docs/workflows/integration-guides/)

## 🤝 Architecture Principles

1. **Data Accuracy Over Speed**: Never sacrifice correctness for performance
2. **Fail Gracefully**: Every external call must have a fallback
3. **Audit Everything**: Complete trail of all data changes
4. **Security First**: Consider security implications in every decision
5. **Scale Horizontally**: Design for distributed systems from day one

---

For implementation details and code examples, see the [technical documentation](docs/technical/).
