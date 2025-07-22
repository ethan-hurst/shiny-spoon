'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Printer } from 'lucide-react'
import Link from 'next/link'

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  downloadUrl?: string
  children: React.ReactNode
}

export function LegalLayout({ title, lastUpdated, downloadUrl, children }: LegalLayoutProps) {
  const handlePrint = () => {
    window.print()
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
              {downloadUrl && (
                <Link href={downloadUrl} download>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="legal-content">
            {children}
          </div>
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