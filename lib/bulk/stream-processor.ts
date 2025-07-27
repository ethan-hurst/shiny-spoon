import { Transform, Writable } from 'stream'
import { pipeline } from 'stream/promises'
import Papa from 'papaparse'

export class CSVStreamProcessor {
  private chunkSize: number
  private concurrency: number

  constructor(options: { chunkSize?: number; concurrency?: number } = {}) {
    this.chunkSize = options.chunkSize || 1000
    this.concurrency = options.concurrency || 5
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

          if (!headers) {
            headers = parsed.data[0]
            this.emit('headers', headers)
            continue
          }

          if (parsed.data.length > 0 && parsed.data[0].length > 0) {
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
          if (parsed.data.length > 0) {
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

    return new Transform(
      {
        objectMode: true,
        transform(record: any, encoding: string, callback: Function) {
          batch.push(record)

          if (batch.length >= this.chunkSize) {
            this.push([...batch])
            batch = []
          }

          callback()
        },
        flush(callback: Function) {
          if (batch.length > 0) {
            this.push(batch)
          }
          callback()
        },
      }.bind(this)
    )
  }

  createConcurrentProcessor<T>(
    processFunc: (batch: any[]) => Promise<T[]>
  ): Transform {
    const processing = new Set<Promise<void>>()

    return new Transform(
      {
        objectMode: true,
        async transform(batch: any[], encoding: string, callback: Function) {
          // Wait if too many concurrent operations
          while (processing.size >= this.concurrency) {
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
        async flush(callback: Function) {
          // Wait for all processing to complete
          await Promise.all(processing)
          callback()
        },
      }.bind(this)
    )
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

// Usage example
export async function processLargeCSV(
  fileStream: NodeJS.ReadableStream,
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
        stats.total += result.batch.length

        if (result.error) {
          stats.failed += result.batch.length
        } else {
          stats.successful += result.results.filter((r) => r.success).length
          stats.failed += result.results.filter((r) => !r.success).length
        }

        callback()
      },
    })
  )

  return stats
}