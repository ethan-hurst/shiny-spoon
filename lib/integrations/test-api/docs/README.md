# TestApi Integration

This document provides information about the TestApi integration implementation.

## Overview

The TestApi integration enables synchronization of data between TruthSource and TestApi, including:

- Products and inventory
- Customer information
- Orders and transactions
- Real-time updates via webhooks

## Configuration

### Authentication


This integration uses API key authentication. You'll need:

1. **API Key**: Your TestApi API key
2. **API Secret** (optional): Additional secret if required
3. **Base URL**: The API endpoint for your TestApi instance

#### Setup
1. Navigate to Integrations > TestApi
2. Enter your API credentials
3. Test the connection to verify setup


### Sync Configuration

Configure which data types to synchronize:

- **Products**: Product catalog, SKUs, descriptions, pricing
- **Customers**: Customer profiles and contact information
- **Orders**: Order history and line items
- **Inventory**: Stock levels and location data

Set sync frequency:
- **Manual**: Sync only when triggered manually
- **Hourly**: Automatic sync every hour
- **Daily**: Automatic sync once per day


### Webhook Configuration

Real-time updates can be enabled using webhooks:

1. **Webhook URL**: `/api/webhooks/test-api`
2. **Webhook Secret**: Set in TestApi and enter in TruthSource
3. **Events**: Configure which events trigger updates

Supported webhook events:
- product.created
- product.updated
- product.deleted
- customer.created
- customer.updated
- order.created
- order.updated


## Data Mapping

### Products

| TruthSource Field | TestApi Field |
|-------------------|------------------|
| name              | name / title     |
| description       | description      |
| sku               | sku / itemId     |
| price             | price            |
| inventory_quantity| stock / inventory|
| status            | active / status  |

### Customers

| TruthSource Field | TestApi Field |
|-------------------|------------------|
| name              | name / companyName |
| email             | email            |
| phone             | phone            |
| address           | address          |

### Orders

| TruthSource Field | TestApi Field |
|-------------------|------------------|
| order_number      | orderNumber / number |
| customer_id       | customerId       |
| status            | status           |
| total_amount      | total            |
| order_date        | createdAt / orderDate |

## API Endpoints

The integration provides the following internal API endpoints:

- `GET /api/integrations/test-api/status` - Integration status
- `POST /api/integrations/test-api/sync` - Trigger manual sync
- `GET /api/integrations/test-api/sync/status` - Sync progress
- `POST /api/webhooks/test-api` - Webhook receiver

## Error Handling

The integration includes comprehensive error handling:

1. **Network Errors**: Automatic retry with exponential backoff
2. **Rate Limiting**: Respects API rate limits with appropriate delays
3. **Authentication Errors**: Automatic token refresh for OAuth
4. **Data Validation**: Input validation before sending to TestApi
5. **Conflict Resolution**: Handles duplicate data and conflicts

Common error scenarios and solutions:

### Authentication Failures
- Verify API credentials are correct
- Check if credentials have expired
- Ensure proper permissions are granted

### Rate Limit Errors
- Integration automatically handles rate limits
- Monitor sync frequency if hitting limits frequently
- Consider spreading sync operations over time

### Data Sync Errors
- Check data format requirements
- Verify required fields are present
- Review field mappings for accuracy

## Monitoring

Monitor integration health through:

1. **Connection Status**: Real-time connection indicator
2. **Sync History**: Log of all synchronization attempts
3. **Error Logs**: Detailed error information and stack traces
4. **Performance Metrics**: Sync duration and data volumes

## Troubleshooting

### Connection Issues
1. Verify credentials are correct and not expired
2. Test network connectivity to TestApi servers
3. Check firewall and proxy settings

### Sync Problems
1. Review sync configuration settings
2. Check for data validation errors in logs
3. Verify required permissions in TestApi

### Performance Issues
1. Reduce sync frequency if overwhelming the API
2. Enable webhooks for real-time updates instead of frequent polling
3. Monitor rate limit usage

## Support

For integration support:

1. Check logs in the TruthSource admin panel
2. Review TestApi API documentation
3. Contact TruthSource support with integration logs

## Version History

- v1.0.0: Initial implementation with basic sync functionality
- v1.1.0: Added webhook support for real-time updates
- Current: Enhanced error handling and performance improvements
