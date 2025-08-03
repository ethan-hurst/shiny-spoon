'use client'

import Link from 'next/link'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  downloadUrl?: string
  children: React.ReactNode
}

export function LegalLayout({
  title,
  lastUpdated,
  downloadUrl,
  children,
}: LegalLayoutProps) {
  const handlePrint = () => {
    window.print()
  }

  // Validate download URL for security
  const isValidDownloadUrl = (url: string) => {
    try {
      const urlObj = new URL(url, window.location.origin)
      // Allow only same origin or trusted domains
      const allowedDomains = [
        window.location.hostname,
        'cdn.truthsource.io',
        'docs.truthsource.io',
      ]
      return (
        allowedDomains.includes(urlObj.hostname) &&
        urlObj.pathname.endsWith('.pdf')
      )
    } catch {
      return false
    }
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8 lg:p-12">
          <div className="mb-8 pb-8 border-b">
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            <p className="text-sm text-gray-600 mb-4">
              Last updated: {lastUpdated}
            </p>

            <div className="flex flex-wrap gap-4">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              {downloadUrl && isValidDownloadUrl(downloadUrl) && (
                <Link href={downloadUrl} download>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="legal-content">{children}</div>
        </Card>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            Have questions about our legal terms?{' '}
            <Link href="/contact" className="text-primary hover:underline">
              Contact us
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
