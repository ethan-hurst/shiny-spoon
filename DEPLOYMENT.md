# Production Deployment Guide

This guide covers deploying the Inventory Management System with horizontal scaling capabilities.

## Prerequisites

- Docker and Docker Compose
- Kubernetes cluster (optional for full scaling)
- Supabase project
- Redis instance (or Upstash Redis)
- Domain name with SSL certificate

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional but recommended
OPENAI_API_KEY=your_openai_key          # For AI features
RESEND_API_KEY=your_resend_key          # For email notifications
UPSTASH_REDIS_REST_URL=your_redis_url   # For rate limiting
UPSTASH_REDIS_REST_TOKEN=your_redis_token
CRON_SECRET=your_32_char_secret         # For cron jobs
METRICS_TOKEN=your_metrics_secret        # For Prometheus endpoint
```

## Database Setup

1. Run all migrations in order:
```bash
npx supabase db push
```

2. Create initial partitions:
```sql
SELECT create_monthly_partition();
```

3. Set up cron job for partition maintenance (using pg_cron or external scheduler):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/partition-maintenance
```

## Deployment Options

### Option 1: Docker Compose (Development/Small Scale)

```bash
# Build and start services
docker-compose up -d

# Scale workers
docker-compose up -d --scale worker=3
```

### Option 2: Kubernetes (Production/Large Scale)

1. Build and push Docker image:
```bash
docker build -t your-registry/inventory-system:latest .
docker push your-registry/inventory-system:latest
```

2. Update image in k8s/deployment.yaml

3. Deploy to Kubernetes:
```bash
kubectl apply -f k8s/
```

4. Configure ingress for your domain

### Option 3: Vercel (Serverless)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel --prod
```

Note: Workers need separate deployment for Vercel

## Post-Deployment

### 1. Health Check
```bash
curl https://your-domain.com/api/health
```

### 2. Set Up Monitoring

Import Grafana dashboard:
1. Add Prometheus data source
2. Import `monitoring/grafana-dashboard.json`
3. Configure alerts as needed

### 3. Configure Rate Limits

Adjust rate limits in `lib/config/env.ts` based on your tier:
- Free: 100 req/min
- Starter: 1000 req/min
- Professional: 10000 req/min
- Enterprise: Unlimited

### 4. Set Up Backups

Configure automated backups:
- Database: Supabase handles this
- Redis: Configure persistence or use Redis snapshots
- File storage: Supabase Storage handles this

## Scaling Guidelines

### Horizontal Scaling Triggers

1. **CPU > 70%**: Add more API pods
2. **Memory > 80%**: Add more pods or increase limits
3. **Queue depth > 1000**: Add more workers
4. **Response time p95 > 500ms**: Add more pods or optimize

### Database Scaling

1. **Read replicas**: For read-heavy workloads
2. **Connection pooling**: Use PgBouncer
3. **Partitioning**: Already implemented for tenant_usage
4. **Sharding**: Use shard_key for future sharding

### Caching Strategy

1. **Short TTL (1 min)**: User sessions, real-time data
2. **Medium TTL (5 min)**: Product listings, inventory counts
3. **Long TTL (1 hour)**: Reports, analytics
4. **Permanent**: Static configuration

## Security Checklist

- [ ] SSL/TLS enabled
- [ ] Environment variables secured
- [ ] Database RLS policies active
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] API keys rotated regularly
- [ ] Monitoring alerts set up
- [ ] Backup strategy in place

## Troubleshooting

### Common Issues

1. **Rate limit errors**
   - Check tenant tier limits
   - Verify Redis connection
   - Review rate limit configuration

2. **Slow queries**
   - Check indexes
   - Review query plans
   - Consider materialized views

3. **High memory usage**
   - Check for memory leaks
   - Review cache size
   - Optimize bundle size

4. **Worker failures**
   - Check Redis connection
   - Review job logs
   - Verify queue configuration

### Monitoring Queries

```sql
-- Active connections by tenant
SELECT organization_id, COUNT(*) 
FROM pg_stat_activity 
GROUP BY organization_id;

-- Slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Tenant usage
SELECT * FROM get_tenant_resource_usage('org-id');
```

## Support

For production support:
1. Check system health: `/api/health`
2. Review metrics: `/api/metrics`
3. Check logs in your logging service
4. Contact support with tenant ID and timestamp