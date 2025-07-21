'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCustomerListRealtime } from '@/hooks/use-customer-realtime'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  UserPlus,
  CreditCard,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { CustomerWithStats, formatCustomerName, getCustomerInitials } from '@/types/customer.types'
import { formatCurrency } from '@/lib/utils'
import { deleteCustomer } from '@/app/actions/customers'
import { toast } from 'sonner'

interface CustomerTableProps {
  customers: CustomerWithStats[]
  currentPage: number
  pageSize: number
  hasMore: boolean
  organizationId?: string
}

export function CustomerTable({ customers, currentPage, pageSize, hasMore, organizationId }: CustomerTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  // Enable real-time updates if organizationId is provided
  if (organizationId) {
    useCustomerListRealtime(organizationId)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
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
      suspended: 'destructive'
    }
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    )
  }

  const getTierBadge = (customer: CustomerWithStats) => {
    if (!customer.tier_name) return null
    
    return (
      <Badge 
        variant="outline"
        style={{ 
          borderColor: customer.tier_color,
          color: customer.tier_color 
        }}
      >
        {customer.tier_name}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No customers found. Try adjusting your filters or add a new customer.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link 
                      href={`/customers/${customer.id}`}
                      className="flex items-center gap-3 hover:opacity-80"
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
                            {customer.contact_count} contact{customer.contact_count !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(customer.status)}
                  </TableCell>
                  <TableCell>
                    {getTierBadge(customer)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(customer.credit_limit, customer.currency)}
                  </TableCell>
                  <TableCell>
                    {customer.total_orders}
                  </TableCell>
                  <TableCell>
                    {customer.account_age_days} days
                  </TableCell>
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
                          <Link href={`/customers/${customer.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/customers/${customer.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
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
                          onClick={() => handleDelete(customer.id)}
                          disabled={deletingId === customer.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
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
            Showing {((currentPage - 1) * pageSize) + 1} to{' '}
            {Math.min(currentPage * pageSize, ((currentPage - 1) * pageSize) + customers.length)} customers
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/customers?page=${currentPage - 1}`)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/customers?page=${currentPage + 1}`)}
              disabled={!hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}