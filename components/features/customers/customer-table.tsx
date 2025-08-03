'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { deleteCustomer } from '@/app/actions/customers'
import { useCustomerListRealtime } from '@/hooks/use-customer-realtime'
import {
  CustomerWithStats,
  formatCustomerName,
  getCustomerInitials,
} from '@/types/customer.types'

interface CustomerTableProps {
  customers: CustomerWithStats[]
  currentPage: number
  pageSize: number
  hasMore: boolean
  organizationId?: string
}

export function CustomerTable({
  customers,
  currentPage,
  pageSize,
  hasMore,
  organizationId,
}: CustomerTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Enable real-time updates - always call hook unconditionally
  useCustomerListRealtime(organizationId || '')

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this customer? This action cannot be undone.'
      )
    ) {
      return
    }

    setDeletingId(id)
    try {
      const result = await deleteCustomer(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Customer deleted successfully')
        router.refresh()
      }
    } catch (error) {
      toast.error('Failed to delete customer')
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive',
    }

    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  const getTierBadge = (customer: CustomerWithStats) => {
    if (!customer.tier_name) return null

    return (
      <Badge
        variant="outline"
        style={{
          borderColor: customer.tier_color,
          color: customer.tier_color,
        }}
      >
        {customer.tier_name}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-md border"
        role="region"
        aria-label="Customer table"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Total Orders</TableHead>
              <TableHead>Account Age</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No customers found. Try adjusting your filters or add a new
                  customer.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link
                      href={`/customers/${customer.id}`}
                      className="flex items-center gap-3 hover:opacity-80"
                      aria-label={`View details for ${formatCustomerName(customer)}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {getCustomerInitials(customer)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {formatCustomerName(customer)}
                        </div>
                        {customer.primary_contact && (
                          <div className="text-sm text-muted-foreground">
                            {customer.contact_count} contact
                            {customer.contact_count !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{getStatusBadge(customer.status)}</TableCell>
                  <TableCell>{getTierBadge(customer)}</TableCell>
                  <TableCell>
                    {formatCurrency(customer.credit_limit, customer.currency)}
                  </TableCell>
                  <TableCell>{customer.total_orders}</TableCell>
                  <TableCell>{customer.account_age_days} days</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={deletingId === customer.id}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/customers/${customer.id}`}
                            aria-label={`View details for ${formatCustomerName(customer)}`}
                          >
                            <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/customers/${customer.id}/edit`}
                            aria-label={`Edit ${formatCustomerName(customer)}`}
                          >
                            <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/customers/${customer.id}/contacts`}
                            aria-label={`Manage contacts for ${formatCustomerName(customer)}`}
                          >
                            <UserPlus
                              className="mr-2 h-4 w-4"
                              aria-hidden="true"
                            />
                            Manage Contacts
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/customers/${customer.id}/pricing`}
                            aria-label={`Manage custom pricing for ${formatCustomerName(customer)}`}
                          >
                            <CreditCard
                              className="mr-2 h-4 w-4"
                              aria-hidden="true"
                            />
                            Custom Pricing
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/orders?customer_id=${customer.id}`}
                            aria-label={`View orders for ${formatCustomerName(customer)}`}
                          >
                            <FileText
                              className="mr-2 h-4 w-4"
                              aria-hidden="true"
                            />
                            View Orders
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(customer.id)}
                          disabled={deletingId === customer.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {(currentPage > 1 || hasMore) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(
              currentPage * pageSize,
              (currentPage - 1) * pageSize + customers.length
            )}{' '}
            customers
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/customers?page=${currentPage - 1}`)}
              disabled={currentPage === 1}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/customers?page=${currentPage + 1}`)}
              disabled={!hasMore}
              aria-label="Go to next page"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
