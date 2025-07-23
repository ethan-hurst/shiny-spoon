import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Invoice } from '@/lib/billing'
import { Download, FileText, ExternalLink } from 'lucide-react'

interface InvoiceHistoryProps {
  invoices: Invoice[]
  hasActiveSubscription: boolean
}

export function InvoiceHistory({ invoices, hasActiveSubscription }: InvoiceHistoryProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      paid: { variant: 'default', label: 'Paid' },
      open: { variant: 'secondary', label: 'Open' },
      past_due: { variant: 'destructive', label: 'Past Due' },
      uncollectible: { variant: 'outline', label: 'Uncollectible' },
      void: { variant: 'outline', label: 'Void' },
    }

    const config = variants[status] || { variant: 'outline', label: status }
    
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    )
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100)
  }

  return (
    <Card id="invoices">
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>
          Download your past invoices and receipts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {hasActiveSubscription 
                ? 'No invoices yet. Your first invoice will appear after your first billing cycle.'
                : 'No invoices to display. Upgrade to a paid plan to see invoices here.'
              }
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.number || `INV-${invoice.id.slice(-8).toUpperCase()}`}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.created * 1000), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {formatAmount(invoice.amount_paid)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(invoice.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.hosted_invoice_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View
                            </a>
                          </Button>
                        )}
                        {invoice.invoice_pdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={invoice.invoice_pdf}
                              download
                              className="flex items-center gap-1"
                            >
                              <Download className="h-4 w-4" />
                              PDF
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {invoices.length > 0 && (
          <div className="mt-4 text-xs text-muted-foreground">
            Showing {invoices.length} most recent invoice{invoices.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  )
}