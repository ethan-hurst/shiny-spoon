# TruthSource - API Contract Specification

## API Overview

**Base URL**: `https://api.truthsource.io`  
**Version**: v1  
**Protocol**: HTTPS only  
**Format**: JSON (application/json)  
**Authentication**: Bearer token (JWT)

## Authentication

### OAuth 2.0 Flow
```http
POST /auth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=ts_1234567890abcdef&
client_secret=sk_live_abcdef1234567890
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_abcdef1234567890",
  "scope": "read:inventory write:inventory read:pricing write:pricing"
}
```

### API Key Authentication (Simple Integration)
```http
GET /api/v1/inventory/SKU-12345
Authorization: Bearer ts_live_1234567890abcdef
```

## Rate Limiting

**Default Limits**:
- Starter: 100 requests/minute
- Professional: 500 requests/minute  
- Enterprise: 2000 requests/minute

**Headers**:
```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1640995200
```

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "meta": {
    "timestamp": "2025-07-15T10:30:00Z",
    "request_id": "req_abc123def456",
    "version": "1.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "INVENTORY_SYNC_FAILED",
    "message": "Unable to sync inventory for SKU-12345",
    "details": {
      "sku": "SKU-12345",
      "source_system": "netsuite",
      "reason": "Item not found in source system"
    },
    "documentation_url": "https://docs.truthsource.io/errors/INVENTORY_SYNC_FAILED"
  },
  "meta": {
    "timestamp": "2025-07-15T10:30:00Z",
    "request_id": "req_abc123def456"
  }
}
```

## Inventory Endpoints

### Get Inventory Status
```http
GET /api/v1/inventory/{sku}
```

**Parameters**:
- `sku` (path): Product SKU
- `include_locations` (query): Include location breakdown (default: false)
- `include_history` (query): Include 24hr history (default: false)

**Example Request**:
```http
GET /api/v1/inventory/WIDGET-001?include_locations=true
Authorization: Bearer ts_live_1234567890abcdef
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "sku": "WIDGET-001",
    "total_available": 847,
    "total_committed": 123,
    "total_on_hand": 970,
    "sync_status": "synchronized",
    "last_sync": "2025-07-15T10:28:45Z",
    "accuracy_score": 0.975,
    "locations": [
      {
        "location_id": "WAREHOUSE-01",
        "location_name": "Main Warehouse",
        "available": 500,
        "committed": 75,
        "on_hand": 575
      },
      {
        "location_id": "WAREHOUSE-02",
        "location_name": "East Coast DC",
        "available": 347,
        "committed": 48,
        "on_hand": 395
      }
    ],
    "systems": {
      "netsuite": {
        "quantity": 847,
        "last_update": "2025-07-15T10:28:30Z",
        "status": "active"
      },
      "shopify": {
        "quantity": 847,
        "last_update": "2025-07-15T10:28:45Z",
        "status": "active"
      }
    }
  }
}
```

### Bulk Inventory Check
```http
POST /api/v1/inventory/bulk-check
```

**Request Body**:
```json
{
  "skus": ["WIDGET-001", "GADGET-002", "TOOL-003"],
  "include_pricing": true,
  "customer_id": "CUST-12345"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "sku": "WIDGET-001",
        "available": 847,
        "price": 49.99,
        "customer_price": 44.99,
        "errors": []
      },
      {
        "sku": "GADGET-002",
        "available": 0,
        "price": 29.99,
        "customer_price": 29.99,
        "errors": ["OUT_OF_STOCK"]
      },
      {
        "sku": "TOOL-003",
        "available": 150,
        "price": 99.99,
        "customer_price": 84.99,
        "errors": []
      }
    ],
    "summary": {
      "total_items": 3,
      "available_items": 2,
      "out_of_stock": 1,
      "accuracy_score": 0.967
    }
  }
}
```

### Update Inventory
```http
PUT /api/v1/inventory/{sku}
```

**Request Body**:
```json
{
  "quantity": 850,
  "adjustment_type": "absolute",
  "reason": "cycle_count",
  "location_id": "WAREHOUSE-01",
  "notes": "Monthly cycle count adjustment"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sku": "WIDGET-001",
    "previous_quantity": 847,
    "new_quantity": 850,
    "adjustment": 3,
    "sync_status": "pending",
    "propagation": {
      "netsuite": "queued",
      "shopify": "queued"
    }
  }
}
```

## Pricing Endpoints

### Get Customer Pricing
```http
GET /api/v1/pricing/{sku}/customer/{customer_id}
```

**Example Request**:
```http
GET /api/v1/pricing/WIDGET-001/customer/CUST-12345
Authorization: Bearer ts_live_1234567890abcdef
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "sku": "WIDGET-001",
    "customer_id": "CUST-12345",
    "customer_name": "Acme Corp",
    "base_price": 49.99,
    "customer_price": 44.99,
    "discount_percentage": 10.0,
    "pricing_tier": "gold",
    "quantity_breaks": [
      {
        "min_quantity": 1,
        "max_quantity": 99,
        "unit_price": 44.99
      },
      {
        "min_quantity": 100,
        "max_quantity": 499,
        "unit_price": 42.99
      },
      {
        "min_quantity": 500,
        "max_quantity": null,
        "unit_price": 39.99
      }
    ],
    "contract_pricing": {
      "enabled": true,
      "contract_id": "CONTRACT-789",
      "fixed_price": 44.99,
      "valid_until": "2025-12-31"
    },
    "currency": "USD",
    "tax_inclusive": false
  }
}
```

### Validate Quote
```http
POST /api/v1/pricing/validate-quote
```

**Request Body**:
```json
{
  "customer_id": "CUST-12345",
  "items": [
    {
      "sku": "WIDGET-001",
      "quantity": 150,
      "quoted_price": 42.99
    },
    {
      "sku": "GADGET-002",
      "quantity": 50,
      "quoted_price": 27.99
    }
  ],
  "quote_date": "2025-07-15",
  "currency": "USD"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "validation_status": "has_errors",
    "total_items": 2,
    "valid_items": 1,
    "invalid_items": 1,
    "items": [
      {
        "sku": "WIDGET-001",
        "quantity": 150,
        "quoted_price": 42.99,
        "expected_price": 42.99,
        "status": "valid",
        "applied_break": "100-499"
      },
      {
        "sku": "GADGET-002",
        "quantity": 50,
        "quoted_price": 27.99,
        "expected_price": 29.99,
        "status": "invalid",
        "error": "PRICE_TOO_LOW",
        "minimum_price": 29.99,
        "discount_exceeded": 6.67
      }
    ]
  }
}
```

## Sync Status Endpoints

### Get Sync Status
```http
GET /api/v1/sync/status
```

**Response**:
```json
{
  "success": true,
  "data": {
    "overall_status": "healthy",
    "accuracy_score": 0.974,
    "last_full_sync": "2025-07-15T08:00:00Z",
    "systems": [
      {
        "system": "netsuite",
        "status": "connected",
        "last_sync": "2025-07-15T10:29:45Z",
        "sync_frequency": "real-time",
        "pending_changes": 0,
        "error_count_24h": 2
      },
      {
        "system": "shopify",
        "status": "connected",
        "last_sync": "2025-07-15T10:30:00Z",
        "sync_frequency": "real-time",
        "pending_changes": 3,
        "error_count_24h": 0
      }
    ],
    "metrics": {
      "items_synced_24h": 15847,
      "sync_errors_24h": 2,
      "average_sync_time": 1.2,
      "data_accuracy": 0.974
    }
  }
}
```

### Trigger Manual Sync
```http
POST /api/v1/sync/trigger
```

**Request Body**:
```json
{
  "sync_type": "incremental",
  "systems": ["netsuite", "shopify"],
  "entities": ["inventory", "pricing"],
  "force": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sync_id": "sync_abc123def456",
    "status": "in_progress",
    "estimated_duration": 300,
    "started_at": "2025-07-15T10:30:00Z",
    "webhook_url": "https://api.truthsource.io/webhooks/sync/sync_abc123def456"
  }
}
```

## Delivery Prediction Endpoints

### Estimate Delivery
```http
POST /api/v1/delivery/estimate
```

**Request Body**:
```json
{
  "items": [
    {
      "sku": "WIDGET-001",
      "quantity": 10,
      "warehouse_id": "WAREHOUSE-01"
    }
  ],
  "destination": {
    "postal_code": "90210",
    "country": "US",
    "is_commercial": true
  },
  "shipping_method": "standard",
  "order_date": "2025-07-15"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "estimated_delivery": "2025-07-20",
    "business_days": 3,
    "confidence_score": 0.92,
    "delivery_window": {
      "earliest": "2025-07-19",
      "latest": "2025-07-21"
    },
    "factors": {
      "warehouse_processing": 1,
      "transit_time": 2,
      "historical_performance": 0.89,
      "current_volume": "normal",
      "weather_impact": "none"
    },
    "carrier_options": [
      {
        "carrier": "UPS",
        "service": "Ground",
        "estimated_delivery": "2025-07-20",
        "cost_estimate": 12.50
      },
      {
        "carrier": "FedEx",
        "service": "2Day",
        "estimated_delivery": "2025-07-17",
        "cost_estimate": 28.75
      }
    ]
  }
}
```

## Error Detection Endpoints

### Get Recent Errors
```http
GET /api/v1/errors?severity=high&limit=10
```

**Response**:
```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "error_id": "err_123abc",
        "timestamp": "2025-07-15T10:15:00Z",
        "severity": "high",
        "category": "inventory_mismatch",
        "message": "Inventory discrepancy detected for SKU-12345",
        "details": {
          "sku": "SKU-12345",
          "netsuite_quantity": 100,
          "shopify_quantity": 0,
          "difference": 100,
          "potential_impact": "$4,999.00"
        },
        "status": "resolved",
        "resolution": {
          "method": "auto_corrected",
          "timestamp": "2025-07-15T10:16:30Z",
          "notes": "Shopify updated to match NetSuite"
        }
      }
    ],
    "pagination": {
      "total": 47,
      "page": 1,
      "per_page": 10,
      "has_more": true
    }
  }
}
```

## Webhook Specifications

### Webhook Registration
```http
POST /api/v1/webhooks
```

**Request Body**:
```json
{
  "url": "https://example.com/webhooks/truthsource",
  "events": [
    "inventory.updated",
    "price.changed",
    "error.detected",
    "sync.completed"
  ],
  "secret": "whsec_1234567890abcdef"
}
```

### Webhook Payload Examples

**Inventory Updated**:
```json
{
  "event": "inventory.updated",
  "timestamp": "2025-07-15T10:30:00Z",
  "data": {
    "sku": "WIDGET-001",
    "previous_quantity": 847,
    "new_quantity": 750,
    "change": -97,
    "trigger": "order_placed",
    "systems_updated": ["netsuite", "shopify"]
  }
}
```

**Error Detected**:
```json
{
  "event": "error.detected",
  "timestamp": "2025-07-15T10:30:00Z",
  "data": {
    "error_id": "err_456def",
    "severity": "critical",
    "category": "pricing_mismatch",
    "affected_sku": "GADGET-002",
    "message": "Customer contract price not applied",
    "impact": {
      "affected_customers": 15,
      "potential_revenue_loss": "$12,500"
    },
    "action_required": true
  }
}
```

### Webhook Security
All webhooks include HMAC-SHA256 signature:
```http
X-TruthSource-Signature: sha256=1234567890abcdef...
```

## Error Codes Reference

### Inventory Errors
- `INVENTORY_SYNC_FAILED`: Unable to sync inventory
- `INVENTORY_NEGATIVE`: Negative inventory detected
- `INVENTORY_OVERSOLD`: More committed than available
- `INVENTORY_STALE`: Data older than 24 hours

### Pricing Errors
- `PRICE_MISMATCH`: Systems show different prices
- `PRICE_BELOW_MINIMUM`: Price below margin threshold
- `CONTRACT_EXPIRED`: Customer contract has expired
- `CURRENCY_CONVERSION_FAILED`: Unable to convert currency

### System Errors
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `AUTHENTICATION_FAILED`: Invalid credentials
- `SYSTEM_UNAVAILABLE`: Source system is down
- `TIMEOUT`: Request timed out

## SDK Examples

### JavaScript/Node.js
```javascript
import TruthSource from '@truthsource/sdk';

const client = new TruthSource({
  apiKey: 'ts_live_1234567890abcdef'
});

// Check inventory
const inventory = await client.inventory.get('WIDGET-001', {
  includeLocations: true
});

// Validate pricing
const validation = await client.pricing.validateQuote({
  customerId: 'CUST-12345',
  items: [
    { sku: 'WIDGET-001', quantity: 100, quotedPrice: 42.99 }
  ]
});

// Handle webhooks
client.webhooks.on('error.detected', (event) => {
  console.log('Error detected:', event.data);
});
```

### Python
```python
from truthsource import TruthSourceClient

client = TruthSourceClient(api_key='ts_live_1234567890abcdef')

# Check inventory
inventory = client.inventory.get('WIDGET-001', include_locations=True)

# Bulk check
results = client.inventory.bulk_check(
    skus=['WIDGET-001', 'GADGET-002'],
    include_pricing=True,
    customer_id='CUST-12345'
)

# Register webhook
webhook = client.webhooks.create(
    url='https://example.com/webhooks',
    events=['inventory.updated', 'error.detected']
)
```

### cURL Examples
```bash
# Get inventory status
curl -X GET https://api.truthsource.io/api/v1/inventory/WIDGET-001 \
  -H "Authorization: Bearer ts_live_1234567890abcdef"

# Trigger sync
curl -X POST https://api.truthsource.io/api/v1/sync/trigger \
  -H "Authorization: Bearer ts_live_1234567890abcdef" \
  -H "Content-Type: application/json" \
  -d '{"sync_type": "incremental", "systems": ["netsuite", "shopify"]}'
```

## API Versioning

### Version Strategy
- Versions in URL path: `/api/v1/`, `/api/v2/`
- Breaking changes require new version
- Non-breaking changes added to current version
- Deprecation notice: 6 months
- Sunset period: 12 months

### Version Headers
```http
X-API-Version: 1.0
X-API-Deprecated: false
X-API-Sunset-Date: null
```

## Performance Guidelines

### Pagination
All list endpoints support pagination:
```
GET /api/v1/inventory?page=2&per_page=50
```

Default: 20 items per page
Maximum: 100 items per page

### Batch Operations
Prefer batch endpoints over multiple individual calls:
- Use `/inventory/bulk-check` instead of multiple `/inventory/{sku}`
- Batch updates with `/inventory/bulk-update`

### Caching
Responses include cache headers:
```http
Cache-Control: private, max-age=60
ETag: "1234567890abcdef"
Last-Modified: Tue, 15 Jul 2025 10:30:00 GMT
```

## Testing Environment

### Sandbox Base URL
`https://sandbox.api.truthsource.io`

### Test Data
- Test SKUs: `TEST-001` through `TEST-999`
- Test Customer: `CUST-TEST-001`
- Test API Key: `ts_test_sandbox123`

### Sandbox Limitations
- Data resets daily at 00:00 UTC
- Rate limits: 50% of production
- Webhook delivery may be delayed
- Some enterprise features disabled
