# Migration Deployment Guide - TruthSource Database

## Overview

This guide provides step-by-step instructions for deploying the refactored migrations to production. The audit identified critical issues that have been resolved through consolidation and additional fixes.

## Pre-Deployment Checklist

### 1. Backup Current Database
```bash
# Create a full backup before proceeding
pg_dump -h your-host -U your-user -d your-database > backup_before_migration.sql
```

### 2. Test Environment Validation
- [ ] Run migrations in test environment
- [ ] Verify all functions work correctly
- [ ] Test RLS policies
- [ ] Validate data integrity

### 3. Production Readiness
- [ ] Schedule maintenance window
- [ ] Notify stakeholders
- [ ] Prepare rollback plan
- [ ] Set up monitoring

## Migration Order

### Phase 1: Core Functions (000_core_functions.sql)
**Purpose**: Standardize all helper functions and remove duplications
```bash
# Apply core functions first
supabase db push --file=supabase/migrations/000_core_functions.sql
```

**What it does**:
- Consolidates all `update_updated_at` functions
- Standardizes helper functions
- Removes function duplications
- Sets up proper permissions

### Phase 2: Core Schema (001_core_schema.sql)
**Purpose**: Consolidate all core tables and resolve conflicts
```bash
# Apply core schema
supabase db push --file=supabase/migrations/001_core_schema.sql
```

**What it does**:
- Creates consolidated core tables
- Resolves table conflicts (audit_logs, api_keys, etc.)
- Sets up RLS policies
- Creates performance indexes
- Establishes proper constraints

### Phase 3: Production Enhancements (scripts/production-deployment.sql)
**Purpose**: Add additional important fixes and best practices
```bash
# Apply production enhancements
psql -h your-host -U your-user -d your-database -f scripts/production-deployment.sql
```

**What it does**:
- Adds data validation functions
- Implements security enhancements
- Creates monitoring functions
- Sets up data retention policies
- Adds performance optimizations

## Critical Fixes Applied

### 1. Function Standardization
- **Issue**: Multiple `update_updated_at` functions with different names
- **Fix**: Consolidated into single `update_updated_at_column()` function
- **Impact**: Eliminates trigger failures and inconsistencies

### 2. Table Conflict Resolution
- **Issue**: Duplicate table definitions across migrations
- **Fix**: Consolidated into single definitions with `IF NOT EXISTS`
- **Impact**: Prevents constraint violations and data corruption

### 3. Security Enhancements
- **Issue**: Inconsistent RLS policies and missing security features
- **Fix**: Comprehensive RLS policies and security monitoring
- **Impact**: Improved data security and threat detection

### 4. Performance Optimizations
- **Issue**: Missing indexes and inefficient queries
- **Fix**: Strategic indexes and query optimizations
- **Impact**: Better performance for large datasets

### 5. Data Validation
- **Issue**: Missing data integrity checks
- **Fix**: Comprehensive validation functions and triggers
- **Impact**: Prevents data corruption and ensures quality

## Additional Important Fixes

### Data Validation Functions
- SKU format validation
- Organization slug validation
- Price and quantity constraints
- Data integrity triggers

### Security Enhancements
- Suspicious activity detection
- Rate limiting functions
- Security event logging
- Threat intelligence tracking

### Monitoring and Maintenance
- Database statistics functions
- Data retention policies
- Cleanup procedures
- Integrity verification

### Compliance Features
- Data export functions
- Audit trail enhancements
- Backup verification
- GDPR compliance tools

## Rollback Plan

### If Migration Fails
1. **Immediate**: Stop the migration process
2. **Assessment**: Identify the failure point
3. **Rollback**: Restore from backup
4. **Investigation**: Fix the issue in test environment
5. **Retry**: Attempt migration again

### Rollback Commands
```bash
# Restore from backup
psql -h your-host -U your-user -d your-database < backup_before_migration.sql

# Or use Supabase CLI
supabase db reset
```

## Post-Deployment Verification

### 1. Core Functionality Test
```sql
-- Test core functions
SELECT update_updated_at_column();
SELECT get_user_organization_id('user-uuid');
SELECT is_org_admin('user-uuid', 'org-uuid');
```

### 2. Data Integrity Check
```sql
-- Verify data integrity
SELECT * FROM verify_data_integrity();
```

### 3. Performance Test
```sql
-- Check database stats
SELECT * FROM get_database_stats();
```

### 4. Security Test
```sql
-- Test security functions
SELECT detect_suspicious_activity('org-uuid', 'ip-address', 'user-uuid');
```

## Monitoring and Maintenance

### Daily Monitoring
- Check error logs for issues
- Monitor performance metrics
- Review security alerts
- Verify data integrity

### Weekly Maintenance
- Run cleanup procedures
- Review audit logs
- Update security policies
- Performance optimization

### Monthly Tasks
- Full data integrity check
- Security audit review
- Performance analysis
- Backup verification

## Troubleshooting

### Common Issues

#### 1. Function Conflicts
**Symptoms**: Migration fails with function already exists
**Solution**: Drop conflicting functions first
```sql
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS update_updated_at_column();
```

#### 2. Table Conflicts
**Symptoms**: Table already exists errors
**Solution**: Use `IF NOT EXISTS` in all table creations

#### 3. Permission Issues
**Symptoms**: Permission denied errors
**Solution**: Ensure proper role permissions
```sql
GRANT ALL PRIVILEGES ON DATABASE your_database TO your_user;
```

#### 4. Performance Issues
**Symptoms**: Slow queries after migration
**Solution**: Check index usage and optimize
```sql
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

## Success Criteria

### Technical Criteria
- [ ] All migrations apply successfully
- [ ] No duplicate tables or functions
- [ ] All RLS policies working
- [ ] Performance within acceptable limits
- [ ] Data integrity verified

### Business Criteria
- [ ] All existing functionality works
- [ ] No data loss
- [ ] Security requirements met
- [ ] Compliance requirements satisfied
- [ ] Performance requirements met

## Support and Resources

### Documentation
- [Migration Audit Report](./MIGRATION_AUDIT_REPORT.md)
- [Database Schema Documentation](./docs/database-schema.md)
- [API Documentation](./docs/api.md)

### Tools
- [Migration Cleanup Script](./scripts/cleanup-migrations.sql)
- [Production Deployment Script](./scripts/production-deployment.sql)
- [Database Monitoring Dashboard](./monitoring/)

### Contacts
- **Database Administrator**: [Contact Info]
- **DevOps Team**: [Contact Info]
- **Security Team**: [Contact Info]

## Timeline

### Week 1: Preparation
- [ ] Complete test environment validation
- [ ] Prepare production environment
- [ ] Schedule maintenance window
- [ ] Notify stakeholders

### Week 2: Deployment
- [ ] Apply Phase 1 migrations
- [ ] Apply Phase 2 migrations
- [ ] Apply Phase 3 enhancements
- [ ] Verify all functionality

### Week 3: Monitoring
- [ ] Monitor performance
- [ ] Review logs
- [ ] Address any issues
- [ ] Document lessons learned

## Conclusion

This migration addresses critical issues identified in the audit while adding important production-ready features. The consolidated approach ensures consistency, performance, and security while maintaining backward compatibility.

**Remember**: Always test in a staging environment first and have a rollback plan ready. 