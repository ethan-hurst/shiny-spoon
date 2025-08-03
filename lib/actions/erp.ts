'use server'

import { createServerClient } from '@/lib/supabase/server'
import { erpRegistry } from '@/lib/integrations/erp/erp-registry'
import { ERPOrchestrator } from '@/lib/integrations/erp/orchestrator'
import { schemaMapper } from '@/lib/integrations/erp/transformers/schema-mapper'
import { ERPType, ERPConfig, FieldMapping } from '@/lib/integrations/erp/types'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// Initialize orchestrator
let orchestrator: ERPOrchestrator | null = null

function getOrchestrator() {
  if (!orchestrator) {
    orchestrator = new ERPOrchestrator()
  }
  return orchestrator
}

// Schemas
const createERPConnectionSchema = z.object({
  type: z.string(),
  config: z.object({
    name: z.string(),
    enabled: z.boolean().default(true),
  }).passthrough(),
  fieldMappings: z.array(z.any()).optional(),
  syncStrategy: z.object({
    type: z.enum(['full', 'incremental', 'real-time']),
    entities: z.array(z.string()),
    interval: z.number().optional(),
    conflictResolution: z.string().optional(),
  }).optional(),
})

export async function createERPConnection(data: z.infer<typeof createERPConnectionSchema>) {
  try {
    const supabase = createServerClient()
    const { data: user } = await supabase.auth.getUser()
    
    if (!user?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get user's organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.user.id)
      .single()

    if (userError || !userData) {
      return { success: false, error: 'User not found' }
    }

    // Check permissions
    if (!['admin', 'owner'].includes(userData.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Validate input
    const validated = createERPConnectionSchema.parse(data)

    // Create ERP connection in database
    const { data: connection, error: connectionError } = await supabase
      .from('erp_connections')
      .insert({
        organization_id: userData.organization_id,
        name: validated.config.name,
        erp_type: validated.type,
        config: validated.config,
        created_by: user.user.id,
      })
      .select()
      .single()

    if (connectionError) {
      return { success: false, error: connectionError.message }
    }

    // Create field mappings if provided
    if (validated.fieldMappings && validated.fieldMappings.length > 0) {
      const mappings = validated.fieldMappings.map(mapping => ({
        erp_connection_id: connection.id,
        entity_type: mapping.entity,
        source_field: mapping.source,
        target_field: mapping.target,
        transform_function: mapping.transform,
        is_required: mapping.required || false,
        default_value: mapping.default,
      }))

      const { error: mappingError } = await supabase
        .from('erp_field_mappings')
        .insert(mappings)

      if (mappingError) {
        console.error('Failed to create field mappings:', mappingError)
      }
    }

    // Create sync strategy if provided
    if (validated.syncStrategy) {
      const { error: strategyError } = await supabase
        .from('erp_sync_strategies')
        .insert({
          erp_connection_id: connection.id,
          strategy_type: validated.syncStrategy.type,
          entities: validated.syncStrategy.entities,
          interval_minutes: validated.syncStrategy.interval,
          conflict_resolution: validated.syncStrategy.conflictResolution,
        })

      if (strategyError) {
        console.error('Failed to create sync strategy:', strategyError)
      }
    }

    // Initialize connection in orchestrator
    try {
      await getOrchestrator().addERP(
        connection.id,
        validated.type as ERPType,
        validated.config as ERPConfig
      )

      if (validated.syncStrategy) {
        getOrchestrator().configureSyncStrategy(connection.id, validated.syncStrategy as any)
      }
    } catch (orchError) {
      console.error('Failed to initialize ERP connection:', orchError)
      // Continue - connection is saved in DB
    }

    revalidatePath('/integrations/erp')
    return { success: true, data: connection }
  } catch (error) {
    console.error('Create ERP connection error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create ERP connection' 
    }
  }
}

export async function getERPConnections() {
  try {
    const supabase = createServerClient()
    const { data: user } = await supabase.auth.getUser()
    
    if (!user?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: connections, error } = await supabase
      .from('erp_connections')
      .select(`
        *,
        erp_sync_strategies (*),
        erp_field_mappings (*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    // Get health status from orchestrator
    const healthStatuses = await getOrchestrator().getHealthStatus()
    
    // Merge health data with connections
    const enrichedConnections = connections.map(conn => {
      const health = healthStatuses.find(h => h.id === conn.id)
      return {
        ...conn,
        connected: health?.connected || false,
        uptime: health?.uptime,
        syncErrors: health?.syncErrors || conn.sync_errors,
      }
    })

    return { success: true, data: enrichedConnections }
  } catch (error) {
    console.error('Get ERP connections error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get ERP connections' 
    }
  }
}

export async function syncERPData(connectionId: string, entity?: string) {
  try {
    const supabase = createServerClient()
    const { data: user } = await supabase.auth.getUser()
    
    if (!user?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify connection exists and user has access
    const { data: connection, error: connError } = await supabase
      .from('erp_connections')
      .select('*, organizations!inner(users!inner(id))')
      .eq('id', connectionId)
      .eq('organizations.users.id', user.user.id)
      .single()

    if (connError || !connection) {
      return { success: false, error: 'Connection not found' }
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from('erp_sync_logs')
      .insert({
        erp_connection_id: connectionId,
        sync_type: entity ? 'incremental' : 'full',
        entity_type: entity || 'all',
        status: 'started',
      })
      .select()
      .single()

    if (logError) {
      return { success: false, error: 'Failed to create sync log' }
    }

    // Perform sync
    try {
      const results = await getOrchestrator().syncAll(entity as any)
      
      // Update sync log
      const summary = results.reduce((acc, r) => ({
        processed: acc.processed + r.success,
        failed: acc.failed + r.failed,
        conflicts: acc.conflicts + r.conflicts,
      }), { processed: 0, failed: 0, conflicts: 0 })

      await supabase
        .from('erp_sync_logs')
        .update({
          status: 'completed',
          records_processed: summary.processed,
          records_failed: summary.failed,
          conflicts_detected: summary.conflicts,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(syncLog.started_at).getTime(),
        })
        .eq('id', syncLog.id)

      // Update last sync time
      await supabase
        .from('erp_connections')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', connectionId)

      revalidatePath('/integrations/erp')
      return { success: true, data: results }
    } catch (syncError) {
      // Update sync log with error
      await supabase
        .from('erp_sync_logs')
        .update({
          status: 'failed',
          error_message: syncError instanceof Error ? syncError.message : 'Sync failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id)

      throw syncError
    }
  } catch (error) {
    console.error('Sync ERP data error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to sync ERP data' 
    }
  }
}

export async function testERPConnection(connectionId: string) {
  try {
    const supabase = createServerClient()
    const { data: user } = await supabase.auth.getUser()
    
    if (!user?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get connection
    const { data: connection, error } = await supabase
      .from('erp_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      return { success: false, error: 'Connection not found' }
    }

    // Test connection
    const connector = erpRegistry.create(connection.config)
    await connector.connect()
    const isConnected = await connector.testConnection()
    await connector.disconnect()

    return { success: true, data: { connected: isConnected } }
  } catch (error) {
    console.error('Test ERP connection error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection test failed' 
    }
  }
}

export async function getDataConflicts() {
  try {
    const supabase = createServerClient()
    const { data: user } = await supabase.auth.getUser()
    
    if (!user?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: conflicts, error } = await supabase
      .from('erp_data_conflicts')
      .select('*')
      .eq('status', 'pending')
      .order('detected_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: conflicts }
  } catch (error) {
    console.error('Get data conflicts error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get conflicts' 
    }
  }
}

export async function resolveConflict(conflictId: string, resolution: any) {
  try {
    const supabase = createServerClient()
    const { data: user } = await supabase.auth.getUser()
    
    if (!user?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check permissions
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (userError || !['admin', 'owner'].includes(userData.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Resolve conflict
    const { error } = await supabase.rpc('resolve_erp_conflict', {
      p_conflict_id: conflictId,
      p_resolution: resolution,
      p_user_id: user.user.id,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/integrations/erp')
    return { success: true }
  } catch (error) {
    console.error('Resolve conflict error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to resolve conflict' 
    }
  }
}

export async function getSyncStatus() {
  try {
    const supabase = createServerClient()
    const { data: user } = await supabase.auth.getUser()
    
    if (!user?.user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get recent sync logs
    const { data: logs, error } = await supabase
      .from('erp_sync_logs')
      .select(`
        *,
        erp_connections (name, erp_type)
      `)
      .order('started_at', { ascending: false })
      .limit(50)

    if (error) {
      return { success: false, error: error.message }
    }

    // Calculate metrics
    const completed = logs.filter(l => l.status === 'completed').length
    const failed = logs.filter(l => l.status === 'failed').length
    const successRate = logs.length > 0 ? Math.round((completed / logs.length) * 100) : 0

    return { 
      success: true, 
      data: {
        logs,
        successRate,
        totalSyncs: logs.length,
        completedSyncs: completed,
        failedSyncs: failed,
      }
    }
  } catch (error) {
    console.error('Get sync status error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get sync status' 
    }
  }
}