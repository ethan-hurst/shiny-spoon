'use client'

import { CustomerWithStats, formatAddress } from '@/types/customer.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Building2, 
  MapPin, 
  CreditCard, 
  Globe, 
  Hash,
  Calendar,
  FileText,
  Shield
} from 'lucide-react'

interface CustomerOverviewProps {
  customer: CustomerWithStats
}

export function CustomerOverview({ customer }: CustomerOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Legal Name</p>
            <p className="text-sm">{customer.company_name}</p>
          </div>
          
          {customer.display_name && customer.display_name !== customer.company_name && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Display Name</p>
              <p className="text-sm">{customer.display_name}</p>
            </div>
          )}
          
          {customer.tax_id && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tax ID</p>
              <p className="text-sm font-mono">{customer.tax_id}</p>
            </div>
          )}
          
          {customer.website && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Website</p>
              <a 
                href={customer.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Globe className="h-3 w-3" />
                {customer.website}
              </a>
            </div>
          )}
          
          <Separator />
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Created</p>
            <p className="text-sm">
              {new Date(customer.created_at).toLocaleDateString()} ({customer.account_age_days} days ago)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Credit Limit</p>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: customer.currency
              }).format(customer.credit_limit)}
            </p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Payment Terms</p>
            <p className="text-sm">Net {customer.payment_terms} days</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-muted-foreground">Currency</p>
            <p className="text-sm">{customer.currency}</p>
          </div>
          
          {customer.tier_name && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pricing Tier</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="outline"
                    style={{ 
                      borderColor: customer.tier_color,
                      color: customer.tier_color 
                    }}
                  >
                    {customer.tier_name}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {customer.tier_discount}% discount
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Billing Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line">
            {formatAddress(customer.billing_address)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line">
            {customer.shipping_address 
              ? formatAddress(customer.shipping_address)
              : <span className="text-muted-foreground">Same as billing address</span>
            }
          </p>
        </CardContent>
      </Card>

      {/* Tags and Notes */}
      {(customer.tags?.length || customer.notes || customer.internal_notes) && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Additional Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.tags && customer.tags.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {customer.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Customer Notes</p>
                <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
            
            {customer.internal_notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Internal Notes (Private)
                </p>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                  {customer.internal_notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Portal Access */}
      {customer.portal_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Customer Portal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant="default">Portal Enabled</Badge>
              {customer.portal_subdomain && (
                <p className="text-sm">
                  Subdomain: <code className="font-mono">{customer.portal_subdomain}</code>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}