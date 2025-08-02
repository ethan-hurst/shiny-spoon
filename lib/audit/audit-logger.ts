// lib/audit/audit-logger.ts
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'login'
  | 'logout'
  | 'invite'
  | 'sync'
  | 'approve'
  | 'reject'
  | 'bulk_import'
  | 'duplicate'

export type EntityType =
  | 'product'
  | 'inventory'
  | 'order'
  | 'customer'
  | 'pricing_rule'
  | 'warehouse'
  | 'integration'
  | 'user'
  | 'organization'
  | 'report'
  | 'products'
  | 'orders'

export interface AuditLogEntry {
  action: AuditAction
  entityType: EntityType
  entityId?: string
  entityName?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  metadata?: Record<string, any>
}

export class AuditLogger {
  private supabase: Awaited<ReturnType<typeof createServerClient>>

  constructor(supabaseClient?: Awaited<ReturnType<typeof createServerClient>>) {
    this.supabase = supabaseClient!
  }

  static async create(supabaseClient?: Awaited<ReturnType<typeof createServerClient>>): Promise<AuditLogger> {
    const client = supabaseClient || await createServerClient()
    return new AuditLogger(client)
  }

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Get current user
      const {
        data: { user },
      } = await this.supabase.auth.getUser()
      if (!user) return

      // Get user profile for organization
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('organization_id, role, full_name')
        .eq('user_id', user.id)
        .single()

      if (!profile?.organization_id) return

      // Get request context
      const headersList = headers()
      const userAgent = headersList.get('user-agent') || ''
      const forwardedFor = headersList.get('x-forwarded-for')
      const realIp = headersList.get('x-real-ip')
      const ip = forwardedFor?.split(',')[0] || realIp || null

      // Create audit log entry
      await this.supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        user_email: user.email || '',
        user_role: profile.role,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        entity_name: entry.entityName,
        old_values: entry.oldValues,
        new_values: entry.newValues,
        metadata: {
          ...entry.metadata,
          user_name: profile.full_name,
        },
        ip_address: ip,
        user_agent: userAgent,
      })
    } catch (error) {
      // Log to error tracking service but don't throw
      console.error('Failed to create audit log:', error)
    }
  }

  // Helper methods for common actions
  async logCreate(entityType: EntityType, entity: any, metadata?: any) {
    await this.log({
      action: 'create',
      entityType,
      entityId: entity.id,
      entityName: entity.name || entity.title || entity.sku,
      newValues: entity,
      metadata,
    })
  }

  async logUpdate(
    entityType: EntityType,
    entityId: string,
    oldValues: any,
    newValues: any,
    metadata?: any
  ) {
    await this.log({
      action: 'update',
      entityType,
      entityId,
      entityName: newValues.name || newValues.title || newValues.sku,
      oldValues,
      newValues,
      metadata,
    })
  }

  async logDelete(entityType: EntityType, entity: any, metadata?: any) {
    await this.log({
      action: 'delete',
      entityType,
      entityId: entity.id,
      entityName: entity.name || entity.title || entity.sku,
      oldValues: entity,
      metadata,
    })
  }

  async logExport(entityType: EntityType, filters: any, recordCount: number) {
    await this.log({
      action: 'export',
      entityType,
      metadata: { filters, recordCount },
    })
  }

  async logView(entityType: EntityType, entityId: string, entityName?: string) {
    await this.log({
      action: 'view',
      entityType,
      entityId,
      entityName,
    })
  }
}

// Server action wrapper to include audit logging
export function withAuditLog<T extends (...args: any[]) => Promise<any>>(
  action: T,
  getAuditInfo: (args: Parameters<T>, result?: any) => AuditLogEntry
): T {
  return (async (...args: Parameters<T>) => {
    const logger = new AuditLogger()
    let result: any
    let error: any

    try {
      result = await action(...args)

      // Log successful action
      const auditInfo = getAuditInfo(args, result)
      await logger.log(auditInfo)

      return result
    } catch (err) {
      error = err

      // Log failed action
      const auditInfo = getAuditInfo(args)
      await logger.log({
        ...auditInfo,
        metadata: {
          ...auditInfo.metadata,
          error: error?.message,
          failed: true,
        },
      })

      throw error
    }
  }) as T
}