// lib/audit/audit-logger.ts
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

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
  private supabase: ReturnType<typeof createClient>

  constructor(supabaseClient?: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient || createClient()
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

      // Create audit log entry using RPC for better security
      await this.supabase.rpc('create_audit_log', {
        p_organization_id: profile.organization_id,
        p_user_id: user.id,
        p_user_email: user.email || '',
        p_user_role: profile.role,
        p_action: entry.action,
        p_entity_type: entry.entityType,
        p_entity_id: entry.entityId,
        p_entity_name: entry.entityName,
        p_old_values: entry.oldValues,
        p_new_values: entry.newValues,
        p_metadata: {
          ...entry.metadata,
          user_name: profile.full_name,
        },
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_request_id: crypto.randomUUID(),
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