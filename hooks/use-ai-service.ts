/**
 * React hooks for AI service integration
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  aiServiceClient,
  DemandForecastRequest,
  DemandForecastResponse,
  DeliveryPredictionRequest,
  DeliveryPredictionResponse,
  AnomalyDetectionRequest,
  AnomalyDetectionResponse,
  HealthResponse
} from '@/lib/ai/client'

/**
 * Hook to check AI service health
 */
export function useAIServiceHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['ai-service', 'health'],
    queryFn: () => aiServiceClient.checkHealth(),
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
    staleTime: 10000 // Consider stale after 10 seconds
  })
}

/**
 * Hook for demand forecasting
 */
export function useDemandForecast() {
  const queryClient = useQueryClient()

  return useMutation<DemandForecastResponse, Error, DemandForecastRequest>({
    mutationFn: (request) => aiServiceClient.forecastDemand(request),
    onSuccess: (data) => {
      // Cache the result
      queryClient.setQueryData(
        ['ai-service', 'demand-forecast', data.forecast_horizon_days], 
        data
      )
    }
  })
}

/**
 * Hook for delivery prediction
 */
export function useDeliveryPrediction() {
  return useMutation<DeliveryPredictionResponse, Error, DeliveryPredictionRequest>({
    mutationFn: (request) => aiServiceClient.predictDelivery(request)
  })
}

/**
 * Hook for anomaly detection
 */
export function useAnomalyDetection() {
  const queryClient = useQueryClient()

  return useMutation<AnomalyDetectionResponse, Error, AnomalyDetectionRequest>({
    mutationFn: (request) => aiServiceClient.detectAnomalies(request),
    onSuccess: (data) => {
      // Invalidate related queries if anomalies found
      if (data.total_anomalies > 0) {
        queryClient.invalidateQueries({
          queryKey: ['inventory']
        })
        queryClient.invalidateQueries({
          queryKey: ['pricing']
        })
        queryClient.invalidateQueries({
          queryKey: ['orders']
        })
      }
    }
  })
}

/**
 * Hook to get recent demand forecasts
 */
export function useRecentDemandForecasts(productIds?: string[]) {
  return useQuery<DemandForecastResponse | null>({
    queryKey: ['ai-service', 'recent-forecasts', productIds],
    queryFn: async () => {
      if (!productIds || productIds.length === 0) return null
      
      // Get cached forecast data
      const cacheKey = ['ai-service', 'demand-forecast', 30] // 30-day forecasts
      const cachedData = queryClient.getQueryData<DemandForecastResponse>(cacheKey)
      
      if (cachedData) {
        // Filter for requested product IDs
        const filteredForecasts = cachedData.forecasts.filter(
          forecast => productIds.includes(forecast.product_id)
        )
        
        return {
          ...cachedData,
          forecasts: filteredForecasts
        }
      }
      
      return null
    },
    enabled: Boolean(productIds && productIds.length > 0),
    staleTime: 300000 // 5 minutes
  })
}

/**
 * Hook for continuous anomaly monitoring
 */
export function useAnomalyMonitoring(
  dataTypes: Array<'inventory' | 'pricing' | 'orders'> = ['inventory', 'pricing', 'orders'],
  enabled = true
) {
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResponse[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)

  const anomalyDetection = useAnomalyDetection()

  useEffect(() => {
    if (!enabled) return

    const runAnomalyCheck = async () => {
      setIsMonitoring(true)
      
      try {
        const results = await Promise.all(
          dataTypes.map(async (dataType) => {
            const request: AnomalyDetectionRequest = {
              data_type: dataType,
              time_range: {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
                end: new Date().toISOString()
              },
              sensitivity: 0.7,
              include_recommendations: true
            }
            
            return anomalyDetection.mutateAsync(request)
          })
        )

        setAnomalies(results)
      } catch (error) {
        console.error('Anomaly monitoring error:', error)
      } finally {
        setIsMonitoring(false)
      }
    }

    // Run initial check
    runAnomalyCheck()

    // Set up periodic checking (every 15 minutes)
    const interval = setInterval(runAnomalyCheck, 15 * 60 * 1000)

    return () => clearInterval(interval)
  }, [enabled, dataTypes, anomalyDetection])

  const totalAnomalies = anomalies.reduce((sum, result) => sum + result.total_anomalies, 0)
  const criticalAnomalies = anomalies.reduce(
    (sum, result) => sum + result.anomalies.filter(a => a.severity === 'critical').length,
    0
  )

  return {
    anomalies,
    totalAnomalies,
    criticalAnomalies,
    isMonitoring,
    lastCheck: anomalies.length > 0 ? anomalies[0]?.analysis_period?.end : null
  }
}

/**
 * Hook for intelligent delivery estimates during checkout
 */
export function useCheckoutDeliveryEstimate(
  warehouseId?: string,
  destinationAddress?: { city: string; state: string; zip: string },
  productIds?: string[]
) {
  const deliveryPrediction = useDeliveryPrediction()

  const estimateDelivery = async (carrier?: string, serviceLevel?: 'standard' | 'express' | 'overnight') => {
    if (!warehouseId || !destinationAddress || !productIds || productIds.length === 0) {
      throw new Error('Missing required information for delivery estimate')
    }

    const request: DeliveryPredictionRequest = {
      origin_warehouse: warehouseId,
      destination_address: destinationAddress,
      product_ids: productIds,
      carrier,
      service_level: serviceLevel || 'standard'
    }

    return deliveryPrediction.mutateAsync(request)
  }

  return {
    estimateDelivery,
    isLoading: deliveryPrediction.isPending,
    error: deliveryPrediction.error,
    data: deliveryPrediction.data
  }
}