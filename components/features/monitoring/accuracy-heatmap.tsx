// PRP-016: Data Accuracy Monitor - Accuracy Heatmap Component
'use client'

import { useMemo } from 'react'
import { AccuracyTrendPoint } from '@/lib/monitoring/types'

interface AccuracyHeatmapProps {
  data: AccuracyTrendPoint[]
  height?: number
}

export function AccuracyHeatmap({ data, height = 400 }: AccuracyHeatmapProps) {
  const heatmapData = useMemo(() => {
    if (!data || data.length === 0) return null

    // Group data by hour of day and day of week
    const grouped: Record<string, Record<number, { total: number; count: number }>> = {}
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    // Initialize structure
    daysOfWeek.forEach(day => {
      grouped[day] = {}
      for (let hour = 0; hour < 24; hour++) {
        grouped[day][hour] = { total: 0, count: 0 }
      }
    })

    // Aggregate data
    data.forEach(point => {
      const dayOfWeek = daysOfWeek[point.timestamp.getDay()]
      const hourOfDay = point.timestamp.getHours()
      
      grouped[dayOfWeek][hourOfDay].total += point.accuracyScore
      grouped[dayOfWeek][hourOfDay].count += 1
    })

    // Calculate averages
    const result: Array<{ day: string; hour: number; accuracy: number }> = []
    
    daysOfWeek.forEach(day => {
      for (let hour = 0; hour < 24; hour++) {
        const cell = grouped[day][hour]
        result.push({
          day,
          hour,
          accuracy: cell.count > 0 ? cell.total / cell.count : 100,
        })
      }
    })

    return result
  }, [data])

  if (!heatmapData) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        Not enough data to generate heatmap. Patterns will appear after more accuracy checks.
      </div>
    )
  }

  const getColor = (accuracy: number) => {
    if (accuracy >= 98) return 'bg-green-500'
    if (accuracy >= 95) return 'bg-green-400'
    if (accuracy >= 90) return 'bg-yellow-400'
    if (accuracy >= 85) return 'bg-orange-400'
    return 'bg-red-500'
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="w-full" style={{ height }}>
      <div className="grid grid-cols-[auto_1fr] gap-4 h-full">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between py-4">
          {daysOfWeek.map(day => (
            <div key={day} className="text-sm text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex flex-col gap-2">
          {/* X-axis labels */}
          <div className="grid grid-cols-24 gap-1 text-xs text-muted-foreground">
            {hours.map(hour => (
              <div key={hour} className="text-center">
                {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
              </div>
            ))}
          </div>

          {/* Heatmap cells */}
          <div className="flex-1 grid grid-rows-7 gap-1">
            {daysOfWeek.map(day => (
              <div key={day} className="grid grid-cols-24 gap-1">
                {hours.map(hour => {
                  const cell = heatmapData.find(d => d.day === day && d.hour === hour)
                  const accuracy = cell?.accuracy || 100
                  
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`${getColor(accuracy)} rounded-sm relative group cursor-pointer transition-all hover:scale-110 hover:z-10`}
                      title={`${day} ${hour}:00 - Accuracy: ${accuracy.toFixed(1)}%`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/90 rounded-sm">
                        <span className="text-xs font-medium">
                          {accuracy.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <span className="text-sm text-muted-foreground">Lower</span>
            <div className="flex gap-1">
              <div className="w-6 h-6 bg-red-500 rounded-sm" title="< 85%" />
              <div className="w-6 h-6 bg-orange-400 rounded-sm" title="85-90%" />
              <div className="w-6 h-6 bg-yellow-400 rounded-sm" title="90-95%" />
              <div className="w-6 h-6 bg-green-400 rounded-sm" title="95-98%" />
              <div className="w-6 h-6 bg-green-500 rounded-sm" title="> 98%" />
            </div>
            <span className="text-sm text-muted-foreground">Higher</span>
          </div>
        </div>
      </div>
    </div>
  )
}