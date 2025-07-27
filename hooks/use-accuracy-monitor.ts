// PRP-016: Data Accuracy Monitor - Real-time Hook
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { AccuracyCheck, Alert, Discrepancy } from '@/lib/monitoring/types'

interface UseAccuracyMonitorProps {
  organizationId: string
  initialAccuracy: number
  initialChecks: AccuracyCheck[]
  initialAlerts: Alert[]
  initialDiscrepancies: Discrepancy[]
}

/**
 * React hook for real-time monitoring of data accuracy metrics for a specific organization using Supabase.
 *
 * Initializes with provided accuracy, checks, alerts, and discrepancies, and maintains up-to-date state by subscribing to relevant Supabase tables. Provides a manual refresh function to reload all monitored data.
 *
 * @param organizationId - The unique identifier of the organization to monitor
 * @param initialAccuracy - The initial accuracy score to seed the state
 * @param initialChecks - The initial list of recent accuracy checks
 * @param initialAlerts - The initial list of active alerts
 * @param initialDiscrepancies - The initial list of recent discrepancies
 * @returns An object containing the current accuracy score, recent checks, active alerts, discrepancies, loading state, and a refresh function
 */
export function useAccuracyMonitor({
  organizationId,
  initialAccuracy,
  initialChecks,
  initialAlerts,
  initialDiscrepancies,
}: UseAccuracyMonitorProps) {
  const [currentAccuracy, setCurrentAccuracy] = useState(initialAccuracy)
  const [recentChecks, setRecentChecks] = useState(initialChecks)
  const [activeAlerts, setActiveAlerts] = useState(initialAlerts)
  const [discrepancies, setDiscrepancies] = useState(initialDiscrepancies)
  const [isLoading, setIsLoading] = useState(false)
  
  const supabase = createClient()

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      // Refresh all data
      const [
        { data: accuracyData },
        { data: checksData },
        { data: alertsData },
        { data: discrepanciesData }
      ] = await Promise.all([
        // Get current accuracy
        supabase
          .from('accuracy_checks')
          .select('accuracy_score')
          .eq('organization_id', organizationId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Get recent checks
        supabase
          .from('accuracy_checks')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Get active alerts
        supabase
          .from('alerts')
          .select(`
            *,
            alert_rules!inner(name)
          `)
          .eq('organization_id', organizationId)
          .in('status', ['active', 'acknowledged'])
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Get recent discrepancies
        supabase
          .from('discrepancies')
          .select('*')
          .eq('organization_id', organizationId)
          .order('detected_at', { ascending: false })
          .limit(50)
      ])

      if (accuracyData) {
        setCurrentAccuracy(accuracyData.accuracy_score)
      }
      if (checksData) {
        setRecentChecks(checksData)
      }
      if (alertsData) {
        setActiveAlerts(alertsData)
      }
      if (discrepanciesData) {
        setDiscrepancies(discrepanciesData)
      }
    } catch (error) {
      console.error('Failed to refresh accuracy monitor data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId, supabase])

  useEffect(() => {
    let channel: RealtimeChannel

    const setupRealtimeSubscription = () => {
      // Subscribe to accuracy check updates
      channel = supabase
        .channel(`accuracy-monitor:${organizationId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'accuracy_checks',
            filter: `organization_id=eq.${organizationId}`,
          },
          (payload: RealtimePostgresChangesPayload<AccuracyCheck>) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              setRecentChecks(prev => [payload.new, ...prev.slice(0, 9)])
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              setRecentChecks(prev => 
                prev.map(check => 
                  check.id === payload.new.id ? payload.new : check
                )
              )
              // Update current accuracy if this check is completed
              if (payload.new.status === 'completed' && payload.new.accuracyScore) {
                setCurrentAccuracy(payload.new.accuracyScore)
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'alerts',
            filter: `organization_id=eq.${organizationId}`,
          },
          (payload: RealtimePostgresChangesPayload<Alert>) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              setActiveAlerts(prev => [payload.new, ...prev])
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              setActiveAlerts(prev => 
                prev.map(alert => 
                  alert.id === payload.new.id ? payload.new : alert
                ).filter(alert => ['active', 'acknowledged'].includes(alert.status))
              )
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'discrepancies',
            filter: `organization_id=eq.${organizationId}`,
          },
          (payload: RealtimePostgresChangesPayload<Discrepancy>) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              setDiscrepancies(prev => [payload.new, ...prev.slice(0, 49)])
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              setDiscrepancies(prev => 
                prev.map(disc => 
                  disc.id === payload.new.id ? payload.new : disc
                )
              )
            }
          }
        )
        .subscribe()
    }

    setupRealtimeSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [organizationId, supabase])

  return {
    currentAccuracy,
    recentChecks,
    activeAlerts,
    discrepancies,
    isLoading,
    refresh,
  }
}