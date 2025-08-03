import { Readable, Transform, Writable } from 'stream'
import { pipeline } from 'stream/promises'
import Papa from 'papaparse'

export class CSVStreamProcessor {
  private chunkSize: number
  private concurrency: number

  constructor(options: { chunkSize?: number; concurrency?: number } = {}) {
    // Validate and set chunk size
    if (options.chunkSize !== undefined) {
      if (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0) {
        throw new Error('chunkSize must be a positive integer')
      }
      this.chunkSize = options.chunkSize
    } else {
      this.chunkSize = 1000
    }

    // Validate and set concurrency
    if (options.concurrency !== undefined) {
      if (!Number.isInteger(options.concurrency) || options.concurrency <= 0) {
        throw new Error('concurrency must be a positive integer')
      }
      this.concurrency = options.concurrency
    } else {
      this.concurrency = 5
    }
  }

  createParseStream(): Transform {
    let buffer = ''
    let headers: string[] | null = null
    let rowCount = 0

    return new Transform({
      objectMode: true,
      transform(chunk: Buffer, encoding: string, callback: Function) {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          const parsed = Papa.parse(line, {
            header: false,
            skipEmptyLines: true,
          })

          // Check for parsing errors
          if (parsed.errors && parsed.errors.length > 0) {
            // Emit error event with details
            this.emit(
              'error',
              new Error(
                `CSV parsing error at line ${rowCount + 1}: ${parsed.errors[0].message}`
              )
            )
            // Skip this line and continue processing
            continue
          }

          if (!headers) {
            if (!parsed.data || parsed.data.length === 0 || !parsed.data[0]) {
              this.emit('error', new Error('Invalid CSV header row'))
              continue
            }
            headers = parsed.data[0]
            this.emit('headers', headers)
            continue
          }

          if (
            parsed.data &&
            parsed.data.length > 0 &&
            parsed.data[0] &&
            parsed.data[0].length > 0
          ) {
            const row = Object.fromEntries(
              headers.map((h, i) => [h, parsed.data[0][i] || ''])
            )

            this.push({
              index: rowCount++,
              data: row,
              raw: line,
            })
          }
        }

        callback()
      },
      flush(callback: Function) {
        if (buffer.trim() && headers) {
          const parsed = Papa.parse(buffer, { skipEmptyLines: true })

          // Check for parsing errors in final buffer
          if (parsed.errors && parsed.errors.length > 0) {
            this.emit(
              'error',
              new Error(
                `CSV parsing error in final line: ${parsed.errors[0].message}`
              )
            )
            callback()
            return
          }

          if (parsed.data && parsed.data.length > 0 && parsed.data[0]) {
            const row = Object.fromEntries(
              headers.map((h, i) => [h, parsed.data[0][i]])
            )
            this.push({
              index: rowCount++,
              data: row,
              raw: buffer,
            })
          }
        }
        callback()
      },
    })
  }

  createBatchStream(): Transform {
    let batch: any[] = []
    const chunkSize = this.chunkSize

    const transform = new Transform({
      objectMode: true,
      transform: (record: any, encoding: string, callback: Function) => {
        batch.push(record)

        if (batch.length >= chunkSize) {
          transform.push([...batch])
          batch = []
        }

        callback()
      },
      flush: (callback: Function) => {
        if (batch.length > 0) {
          transform.push(batch)
        }
        callback()
      },
    })

    return transform
  }

  createConcurrentProcessor<T>(
    processFunc: (batch: any[]) => Promise<T[]>
  ): Transform {
    const processing = new Set<Promise<void>>()
    const concurrency = this.concurrency
    const self = this

    return new Transform({
      objectMode: true,
      async transform(
        this: Transform,
        batch: any[],
        encoding: string,
        callback: Function
      ) {
        // Wait if too many concurrent operations
        while (processing.size >= concurrency) {
          await Promise.race(processing)
        }

        // Process batch
        const promise = processFunc(batch)
          .then((results) => {
            this.push({ batch, results })
          })
          .catch((error) => {
            this.push({ batch, error })
          })
          .finally(() => {
            processing.delete(promise)
          })

        processing.add(promise)
        callback()
      },
      async flush(this: Transform, callback: Function) {
        // Wait for all processing to complete
        await Promise.all(processing)
        callback()
      },
    })
  }

  createProgressStream(
    onProgress: (progress: {
      processed: number
      total?: number
      rate: number
    }) => void
  ): Transform {
    let processed = 0
    let startTime = Date.now()
    let lastEmit = 0

    return new Transform({
      objectMode: true,
      transform(chunk: any, encoding: string, callback: Function) {
        processed++

        const now = Date.now()
        if (now - lastEmit > 100) {
          // Emit every 100ms
          const elapsed = (now - startTime) / 1000
          const rate = processed / elapsed

          onProgress({ processed, rate })
          lastEmit = now
        }

        this.push(chunk)
        callback()
      },
    })
  }
}

/**
 * Processes a large CSV file stream in batches with concurrency and progress reporting.
 *
 * Streams the CSV data, parses and batches records, processes each batch concurrently using the provided processor function, and reports progress via a callback. Returns statistics on the total, successful, and failed records after processing completes.
 *
 * @param fileStream - Readable stream containing CSV data
 * @param processor - Asynchronous function to process each batch of records
 * @param onProgress - Callback invoked periodically with progress updates
 * @returns An object containing the total, successful, and failed record counts
 */
export async function processLargeCSV(
  fileStream: Readable,
  processor: (batch: any[]) => Promise<any[]>,
  onProgress: (progress: any) => void
): Promise<{ total: number; successful: number; failed: number }> {
  const streamProcessor = new CSVStreamProcessor({
    chunkSize: 500,
    concurrency: 3,
  })

  let stats = { total: 0, successful: 0, failed: 0 }

  await pipeline(
    fileStream,
    streamProcessor.createParseStream(),
    streamProcessor.createProgressStream(onProgress),
    streamProcessor.createBatchStream(),
    streamProcessor.createConcurrentProcessor(processor),
    new Writable({
      objectMode: true,
      write(result: any, encoding: string, callback: Function) {
        // Only count total when we have actual records
        if (result.batch && Array.isArray(result.batch)) {
          stats.total += result.batch.length
        }

        if (result.error) {
          // This is a batch-level error, don't automatically count all as failed
          // Log the error but let individual results determine the count
          console.error('Batch processing error:', result.error)
        }

        if (result.results && Array.isArray(result.results)) {
          // Count individual record results
          stats.successful += result.results.filter((r) => r.success).length
          stats.failed += result.results.filter((r) => !r.success).length
        } else if (result.error && result.batch) {
          // Only count all as failed if we have a batch-level error AND no individual results
          stats.failed += result.batch.length
        }

        callback()
      },
    })
  )

  return stats
}
