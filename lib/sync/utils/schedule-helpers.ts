// PRP-015: Sync Scheduling Helper Functions

/**
 * Calculate the next run time based on a given frequency and starting time
 * 
 * @param frequency - The scheduling frequency (e.g., 'every_5_min', 'hourly', 'daily')
 * @param from - The starting date/time to calculate from
 * @returns The next scheduled run time
 */
export function calculateNextRun(frequency: string, from: Date): Date {
  const next = new Date(from)
  
  switch (frequency) {
    case 'every_5_min':
      next.setMinutes(next.getMinutes() + 5)
      break
    case 'every_15_min':
      next.setMinutes(next.getMinutes() + 15)
      break
    case 'every_30_min':
      next.setMinutes(next.getMinutes() + 30)
      break
    case 'hourly':
      next.setHours(next.getHours() + 1)
      next.setMinutes(0)
      next.setSeconds(0)
      break
    case 'daily':
      next.setDate(next.getDate() + 1)
      next.setHours(0)
      next.setMinutes(0)
      next.setSeconds(0)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      next.setHours(0)
      next.setMinutes(0)
      next.setSeconds(0)
      break
    default:
      // Default to hourly if unknown frequency
      next.setHours(next.getHours() + 1)
      next.setMinutes(0)
      next.setSeconds(0)
  }
  
  return next
}