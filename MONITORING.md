# Monitoring & Error Tracking System

This document outlines the comprehensive monitoring and error tracking system implemented for TruthSource.

## Overview

The monitoring system provides real-time visibility into application health, performance, and errors across all environments.

## Components

### 1. Sentry Integration

**Configuration Files:**
- `sentry.client.config.ts` - Browser-side error tracking
- `sentry.server.config.ts` - Server-side error tracking  
- `sentry.edge.config.ts` - Edge runtime error tracking

**Features:**
- Automatic error capture and reporting
- Performance monitoring with traces
- Session replay for debugging
- User context tracking
- Custom breadcrumbs for debugging

### 2. Health Check System

**Endpoint:** `/api/health`

**Checks:**
- Database connectivity
- Redis cache health (if configured)
- External API health (Supabase, Stripe, etc.)
- System metrics (memory, CPU usage)
- Response time monitoring

**Response Format:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "database": { "status": "healthy", "responseTime": 150 },
    "redis": { "status": "healthy", "responseTime": 50 },
    "externalApis": { "status": "healthy", "responseTime": 200 }
  },
  "metrics": {
    "memory": { "used": 512, "total": 1024, "percentage": 50 },
    "cpu": { "usage": 0.5 }
  }
}
```

### 3. Performance Monitoring

**Middleware:** `lib/monitoring/performance-middleware.ts`

**Features:**
- API response time tracking
- Error rate monitoring
- Request/response logging
- Custom headers for monitoring
- User context tracking

**Usage:**
```typescript
import { withPerformanceMonitoring } from '@/lib/monitoring/performance-middleware'

export const GET = withPerformanceMonitoring(async (request) => {
  // Your API logic here
})
```

### 4. Error Boundaries

**Component:** `components/ui/error-boundary.tsx`

**Features:**
- React error boundary with Sentry integration
- User-friendly error UI
- Error reporting dialog
- Retry functionality
- Development error details

**Usage:**
```tsx
import { ErrorBoundary } from '@/components/ui/error-boundary'

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### 5. Monitoring Dashboard

**Component:** `components/features/monitoring/monitoring-dashboard.tsx`

**Features:**
- Real-time system health display
- Service status indicators
- Performance metrics visualization
- Memory and CPU usage charts
- API performance tracking

**Access:** `/monitoring`

### 6. Monitoring Hooks

**File:** `hooks/use-monitoring.ts`

**Available Hooks:**
- `useMonitoring()` - General monitoring functionality
- `usePageTracking()` - Page view tracking
- `useActionTracking()` - User action tracking
- `useApiTracking()` - API call tracking

**Usage:**
```typescript
import { useMonitoring, usePageTracking } from '@/hooks/use-monitoring'

function MyComponent() {
  const { trackEvent, trackError } = useMonitoring({
    userId: 'user123',
    componentName: 'MyComponent'
  })
  
  usePageTracking('Dashboard', 'user123')
  
  const handleAction = () => {
    trackEvent('Button Clicked', { buttonId: 'submit' })
  }
}
```

## Environment Variables

### Required for Production

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_DSN=your_sentry_dsn
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=your_sentry_project

# App Configuration
NEXT_PUBLIC_APP_ENV=production
APP_VERSION=1.0.0

# Redis (Optional)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

## Setup Instructions

### 1. Sentry Setup

1. Create a Sentry account and project
2. Get your DSN from Sentry dashboard
3. Add environment variables to your `.env.local`
4. Deploy with Sentry configuration

### 2. Health Check Setup

1. Ensure your database is accessible
2. Configure Redis if using caching
3. Set up external API credentials
4. Test the `/api/health` endpoint

### 3. Performance Monitoring

1. Wrap your API routes with performance monitoring
2. Set up alerts for slow responses (>5s)
3. Monitor error rates and response times

### 4. Error Boundaries

1. Wrap critical components with ErrorBoundary
2. Test error scenarios in development
3. Configure error reporting preferences

## Monitoring Best Practices

### 1. Error Tracking

- Always include context with errors
- Use appropriate error levels (info, warning, error)
- Filter out noise (browser errors, network issues)
- Set up alerts for critical errors

### 2. Performance Monitoring

- Monitor API response times
- Track database query performance
- Monitor external API calls
- Set up performance budgets

### 3. Health Checks

- Run health checks every 30 seconds
- Set up alerts for unhealthy status
- Monitor uptime and availability
- Track service dependencies

### 4. User Experience

- Track user actions and flows
- Monitor page load times
- Track conversion rates
- Monitor user feedback

## Alerting Configuration

### Sentry Alerts

1. **Error Rate Alerts**
   - Alert when error rate > 5% in 5 minutes
   - Alert when new error types appear

2. **Performance Alerts**
   - Alert when response time > 5 seconds
   - Alert when memory usage > 80%

3. **Availability Alerts**
   - Alert when health check fails
   - Alert when services are down

### Custom Alerts

```typescript
// Example: Custom alert for critical errors
sentryService.captureMessage('Critical System Error', 'error', {
  severity: 'critical',
  component: 'payment-processing',
  userId: 'user123'
})
```

## Dashboard Features

### Real-time Monitoring

- System health status
- Service availability
- Performance metrics
- Error rates and trends

### Historical Data

- Performance trends over time
- Error frequency analysis
- User behavior patterns
- System resource usage

### Custom Metrics

- Business-specific KPIs
- User engagement metrics
- Feature usage tracking
- Conversion funnel analysis

## Troubleshooting

### Common Issues

1. **Sentry not capturing errors**
   - Check DSN configuration
   - Verify environment variables
   - Check network connectivity

2. **Health checks failing**
   - Verify database connectivity
   - Check external API credentials
   - Review service configurations

3. **Performance issues**
   - Monitor database queries
   - Check external API response times
   - Review caching strategies

### Debug Mode

Enable debug mode in development:

```typescript
// In sentry config files
debug: process.env.NODE_ENV === 'development'
```

## Security Considerations

### Data Privacy

- Filter sensitive data in error reports
- Anonymize user information
- Remove PII from logs and metrics
- Comply with data protection regulations

### Access Control

- Restrict monitoring dashboard access
- Use role-based permissions
- Audit monitoring system access
- Secure monitoring credentials

## Integration with CI/CD

### Deployment Monitoring

- Track deployment success/failure
- Monitor post-deployment health
- Alert on deployment issues
- Track feature flag changes

### Automated Testing

- Monitor test execution
- Track test coverage
- Alert on test failures
- Performance regression testing

## Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - User behavior analysis
   - Predictive monitoring
   - Anomaly detection
   - Custom dashboards

2. **Integration Enhancements**
   - DataDog integration
   - New Relic integration
   - Custom monitoring tools
   - Third-party service monitoring

3. **Automation**
   - Auto-scaling based on metrics
   - Automated incident response
   - Self-healing systems
   - Predictive maintenance

## Support and Maintenance

### Regular Maintenance

- Update monitoring dependencies
- Review and optimize alerts
- Clean up old metrics data
- Update monitoring configurations

### Documentation Updates

- Keep monitoring docs current
- Update setup instructions
- Document new features
- Maintain troubleshooting guides