import { createBrowserClient } from '@/lib/supabase/client'
import { SyncInterval, SyncResult, SyncStatus } from '@/lib/sync/types'

export class SyncScheduler {
  private supabase = createBrowserClient()

  async scheduleSync(syncConfig: any): Promise<SyncResult> {
    try {
      const nextSyncTime = this.getNextSyncTime(
        new Date(),
        syncConfig.interval,
        syncConfig.custom_interval_minutes
      )

      const { data, error } = await this.supabase
        .from('sync_schedules')
        .insert({
          sync_config_id: syncConfig.id,
          integration_id: syncConfig.integration_id,
          scheduled_at: nextSyncTime.toISOString(),
          status: 'scheduled',
        })
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to schedule sync',
      }
    }
  }

  getNextSyncTime(
    lastSync: Date,
    interval: SyncInterval,
    customMinutes?: number
  ): Date {
    const nextSync = new Date(lastSync)

    switch (interval) {
      case SyncInterval.EVERY_15_MINUTES:
        nextSync.setMinutes(nextSync.getMinutes() + 15)
        break
      case SyncInterval.EVERY_30_MINUTES:
        nextSync.setMinutes(nextSync.getMinutes() + 30)
        break
      case SyncInterval.EVERY_HOUR:
        nextSync.setHours(nextSync.getHours() + 1)
        break
      case SyncInterval.EVERY_6_HOURS:
        nextSync.setHours(nextSync.getHours() + 6)
        break
      case SyncInterval.DAILY:
        nextSync.setDate(nextSync.getDate() + 1)
        break
      case SyncInterval.WEEKLY:
        nextSync.setDate(nextSync.getDate() + 7)
        break
      case SyncInterval.CUSTOM:
        if (customMinutes) {
          nextSync.setMinutes(nextSync.getMinutes() + customMinutes)
        }
        break
    }

    return nextSync
  }

  async processPendingSyncs(): Promise<SyncResult> {
    try {
      const now = new Date()
      const { data: pendingSyncs } = await this.supabase
        .from('sync_schedules')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10)

      if (!pendingSyncs || pendingSyncs.length === 0) {
        return {
          success: true,
          data: { processed: 0, failed: 0 },
        }
      }

      let processed = 0
      let failed = 0

      for (const schedule of pendingSyncs) {
        try {
          // Execute sync
          await this.executeScheduledSync(schedule)
          processed++

          // Update schedule status
          await this.supabase
            .from('sync_schedules')
            .update({
              status: 'completed',
              executed_at: new Date().toISOString(),
            })
            .eq('id', schedule.id)
        } catch (error) {
          failed++
          await this.supabase
            .from('sync_schedules')
            .update({
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('id', schedule.id)
        }
      }

      return {
        success: true,
        data: { processed, failed },
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process pending syncs',
      }
    }
  }

  private async executeScheduledSync(schedule: any): Promise<void> {
    // This would trigger the actual sync
    // For now, just mark as completed
    await this.supabase.from('sync_logs').insert({
      sync_config_id: schedule.sync_config_id,
      integration_id: schedule.integration_id,
      status: SyncStatus.COMPLETED,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      records_synced: 0,
    })
  }

  async cancelScheduledSync(scheduleId: string): Promise<SyncResult> {
    try {
      const { data, error } = await this.supabase
        .from('sync_schedules')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', scheduleId)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel sync',
      }
    }
  }

  async getScheduledSyncs(startDate: Date, endDate: Date): Promise<SyncResult> {
    try {
      const { data, error } = await this.supabase
        .from('sync_schedules')
        .select('*')
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get scheduled syncs',
      }
    }
  }

  async updateSyncInterval(
    syncConfigId: string,
    newInterval: SyncInterval
  ): Promise<SyncResult> {
    try {
      // Get current config
      const { data: config } = await this.supabase
        .from('sync_configs')
        .select('*')
        .eq('id', syncConfigId)
        .single()

      if (!config) {
        throw new Error('Sync config not found')
      }

      // Update interval
      const { data, error } = await this.supabase
        .from('sync_configs')
        .update({
          interval: newInterval,
          updated_at: new Date().toISOString(),
        })
        .eq('id', syncConfigId)
        .select()
        .single()

      if (error) throw error

      // Reschedule next sync
      const nextSyncTime = this.getNextSyncTime(
        new Date(config.last_sync || new Date()),
        newInterval
      )

      await this.supabase.from('sync_schedules').insert({
        sync_config_id: syncConfigId,
        integration_id: config.integration_id,
        scheduled_at: nextSyncTime.toISOString(),
        status: 'scheduled',
      })

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update sync interval',
      }
    }
  }

  async pauseSync(syncConfigId: string): Promise<SyncResult> {
    try {
      const { data, error } = await this.supabase
        .from('sync_configs')
        .update({
          active: false,
          paused_at: new Date().toISOString(),
        })
        .eq('id', syncConfigId)
        .select()
        .single()

      if (error) throw error

      // Cancel pending schedules
      await this.supabase
        .from('sync_schedules')
        .update({ status: 'cancelled' })
        .eq('sync_config_id', syncConfigId)
        .eq('status', 'scheduled')

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause sync',
      }
    }
  }

  async resumeSync(syncConfigId: string): Promise<SyncResult> {
    try {
      const { data, error } = await this.supabase
        .from('sync_configs')
        .update({
          active: true,
          resumed_at: new Date().toISOString(),
        })
        .eq('id', syncConfigId)
        .select()
        .single()

      if (error) throw error

      // Schedule next sync
      await this.scheduleSync(data)

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume sync',
      }
    }
  }
}
