import { ConflictResolution, ConflictType, SyncConflict, SyncResult } from '@/lib/sync/types'
import { createBrowserClient } from '@/lib/supabase/client'

export class ConflictResolutionService {
  private supabase = createBrowserClient()

  async detectConflicts(localData: any, externalData: any): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    // Compare timestamps
    if (localData.updated_at && externalData.updated_at) {
      const localTime = new Date(localData.updated_at).getTime()
      const externalTime = new Date(externalData.updated_at).getTime()

      if (Math.abs(localTime - externalTime) > 1000) { // More than 1 second difference
        conflicts.push({
          id: `conflict-${Date.now()}`,
          type: ConflictType.UPDATE_CONFLICT,
          field: 'updated_at',
          local_value: localData.updated_at,
          external_value: externalData.updated_at,
          description: 'Both records have been updated recently',
        })
      }
    }

    // Compare field values
    const fieldsToCompare = ['quantity', 'price', 'name', 'status']
    for (const field of fieldsToCompare) {
      if (field in localData && field in externalData) {
        if (localData[field] !== externalData[field]) {
          conflicts.push({
            id: `conflict-${Date.now()}-${field}`,
            type: ConflictType.DATA_MISMATCH,
            field,
            local_value: localData[field],
            external_value: externalData[field],
            description: `${field} values differ between local and external systems`,
          })
        }
      }
    }

    return conflicts
  }

  async resolveConflicts(
    conflicts: SyncConflict[],
    resolution: ConflictResolution
  ): Promise<SyncResult> {
    const resolved: any[] = []
    const failed: any[] = []

    for (const conflict of conflicts) {
      try {
        const resolvedData = await this.applyResolution(conflict, resolution)
        resolved.push(resolvedData)
      } catch (error) {
        failed.push({
          conflict,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      success: failed.length === 0,
      data: {
        resolved: resolved.length,
        failed: failed.length,
        conflicts: failed,
      },
    }
  }

  private async applyResolution(
    conflict: SyncConflict,
    resolution: ConflictResolution
  ): Promise<any> {
    switch (resolution) {
      case ConflictResolution.LOCAL_WINS:
        return { [conflict.field]: conflict.local_value }
      
      case ConflictResolution.EXTERNAL_WINS:
        return { [conflict.field]: conflict.external_value }
      
      case ConflictResolution.MERGE:
        return this.mergeValues(conflict)
      
      case ConflictResolution.MANUAL:
        // In a real implementation, this would queue for manual review
        throw new Error('Manual resolution required')
      
      default:
        throw new Error(`Unknown resolution strategy: ${resolution}`)
    }
  }

  private mergeValues(conflict: SyncConflict): any {
    // Simple merge strategy - can be customized based on field type
    if (conflict.field === 'quantity' || conflict.field === 'price') {
      // For numeric fields, take the maximum value
      const localVal = Number(conflict.local_value)
      const externalVal = Number(conflict.external_value)
      return { [conflict.field]: Math.max(localVal, externalVal) }
    }

    // For other fields, prefer the most recent value
    // This is a simplified approach
    return { [conflict.field]: conflict.external_value }
  }

  async getConflictHistory(syncId: string): Promise<SyncConflict[]> {
    const { data, error } = await this.supabase
      .from('sync_conflicts')
      .select('*')
      .eq('sync_log_id', syncId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  }

  async saveConflictResolution(
    syncId: string,
    conflict: SyncConflict,
    resolution: string,
    resolvedValue: any
  ): Promise<void> {
    await this.supabase
      .from('sync_conflicts')
      .insert({
        sync_log_id: syncId,
        conflict_type: conflict.type,
        field: conflict.field,
        local_value: conflict.local_value,
        external_value: conflict.external_value,
        resolution_action: resolution,
        resolved_value: resolvedValue,
        created_at: new Date().toISOString(),
      })
  }
}