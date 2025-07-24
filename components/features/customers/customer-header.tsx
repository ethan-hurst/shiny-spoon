'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Clock,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  Mail,
  MoreVertical,
  Package,
  Phone,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/utils'
import { deleteCustomer } from '@/app/actions/customers'
import {
  CustomerWithStats,
  formatCustomerName,
  getCustomerInitials,
} from '@/types/customer.types'

interface CustomerHeaderProps {
  customer: CustomerWithStats
}

export function CustomerHeader({ customer }: CustomerHeaderProps) {
  const router = useRouter()

  const handleDelete = async () => {
    if (
      !confirm(
        'Are you sure you want to delete this customer? This action cannot be undone.'
      )
    ) {
      return
    }

    try {
      const result = await deleteCustomer(customer.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Customer deleted successfully')
        router.push('/customers')
      }
    } catch (error) {
      toast.error('Failed to delete customer')
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
    }
    return colors[status as keyof typeof colors] || colors.inactive
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">
              {getCustomerInitials(customer)}
            </AvatarFallback>
          </Avatar>

          <div>
            <h1 className="text-3xl font-bold">
              {formatCustomerName(customer)}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={getStatusColor(customer.status)}>
                {customer.status}
              </Badge>

              {customer.customer_type !== 'standard' && (
                <Badge variant="outline">
                  {customer.customer_type === 'vip' && '⭐ VIP'}
                  {customer.customer_type === 'partner' && '🤝 Partner'}
                </Badge>
              )}

              {customer.tier_name && (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: customer.tier_color,
                    color: customer.tier_color,
                  }}
                >
                  {customer.tier_name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href={`/customers/${customer.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href={`/customers/${customer.id}/contacts`}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Manage Contacts
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href={`/customers/${customer.id}/pricing`}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Custom Pricing
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href={`/orders?customer_id=${customer.id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  View Orders
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Customer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Package className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{customer.total_orders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <DollarSign className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(customer.total_revenue, customer.currency)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Credit Limit</p>
              <p className="text-2xl font-bold">
                {formatCurrency(customer.credit_limit, customer.currency)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Customer Since</p>
              <p className="text-2xl font-bold">
                {customer.account_age_days} days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info Bar */}
      {customer.primary_contact && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {customer.primary_contact.email}
                </span>
              </div>
              {customer.primary_contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {customer.primary_contact.phone}
                  </span>
                </div>
              )}
              <Badge variant="secondary">
                {customer.primary_contact.first_name}{' '}
                {customer.primary_contact.last_name} - Primary Contact
              </Badge>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/customers/${customer.id}/contacts`}>
                View All Contacts ({customer.contact_count})
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
