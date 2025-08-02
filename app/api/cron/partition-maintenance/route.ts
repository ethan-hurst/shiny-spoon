import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Cron job for partition maintenance
 * Runs monthly to create new partitions and clean up old ones
 * 
 * Schedule: 0 0 1 * * (First day of each month at midnight)
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const results = {
      partitionsCreated: [] as string[],
      partitionsDropped: [] as string[],
      errors: [] as string[],
    }

    // Create partitions for the next 3 months
    for (let i = 1; i <= 3; i++) {
      const date = new Date()
      date.setMonth(date.getMonth() + i)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      
      try {
        // Call the partition creation function
        const { error } = await supabase.rpc('create_monthly_partition')
        
        if (error) {
          results.errors.push(`Failed to create partition for ${year}-${month}: ${error.message}`)
        } else {
          results.partitionsCreated.push(`tenant_usage_${year}_${month}`)
        }
      } catch (error) {
        results.errors.push(`Error creating partition: ${error}`)
      }
    }

    // Clean up old partitions (older than 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    try {
      // Get list of old partitions
      const { data: oldPartitions, error } = await supabase.rpc('get_old_partitions', {
        cutoff_date: sixMonthsAgo.toISOString(),
      })

      if (error) {
        results.errors.push(`Failed to get old partitions: ${error.message}`)
      } else if (oldPartitions) {
        // Drop old partitions
        for (const partition of oldPartitions) {
          try {
            const { error: dropError } = await supabase.rpc('drop_partition', {
              partition_name: partition.table_name,
            })
            
            if (dropError) {
              results.errors.push(`Failed to drop ${partition.table_name}: ${dropError.message}`)
            } else {
              results.partitionsDropped.push(partition.table_name)
            }
          } catch (error) {
            results.errors.push(`Error dropping partition: ${error}`)
          }
        }
      }
    } catch (error) {
      results.errors.push(`Error managing old partitions: ${error}`)
    }

    // Run database maintenance
    try {
      // Analyze tables for query optimization
      await supabase.rpc('analyze_tenant_tables')
      
      // Vacuum to reclaim space
      await supabase.rpc('vacuum_tenant_tables')
    } catch (error) {
      results.errors.push(`Database maintenance error: ${error}`)
    }

    // Log results
    console.log('Partition maintenance completed:', results)

    return NextResponse.json({
      success: results.errors.length === 0,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Partition maintenance error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}