'use client'

import { useState } from 'react'
import { ContactRecord, formatContactName } from '@/types/customer.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContactDialog } from '@/components/features/customers/contact-dialog'
import { deleteContact } from '@/app/actions/customers'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Mail, 
  Phone,
  Smartphone,
  Star,
  Shield,
  Bell,
  BellOff
} from 'lucide-react'

interface CustomerContactsProps {
  customerId: string
  contacts: ContactRecord[]
}

export function CustomerContacts({ customerId, contacts }: CustomerContactsProps) {
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleEdit = (contact: ContactRecord) => {
    setEditingContact(contact)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return
    }

    setDeletingId(id)
    try {
      const result = await deleteContact(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Contact deleted successfully')
        router.refresh()
      }
    } catch (error) {
      toast.error('Failed to delete contact')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingContact(null)
  }

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      primary: 'default',
      billing: 'secondary',
      shipping: 'secondary',
      contact: 'outline'
    }
    
    return (
      <Badge variant={variants[role] || 'outline'}>
        {role}
      </Badge>
    )
  }

  if (contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
          <CardDescription>
            No contacts have been added yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Add contacts to manage communication with this customer
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Contact
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>
                Manage contacts for this customer
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Preferences</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {contact.first_name[0]}{contact.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {formatContactName(contact)}
                          {contact.is_primary && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {contact.notes && (
                          <p className="text-sm text-muted-foreground">{contact.notes}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <a 
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-1 text-sm hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contact.phone && (
                        <a 
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 text-sm hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.mobile && (
                        <a 
                          href={`tel:${contact.mobile}`}
                          className="flex items-center gap-1 text-sm hover:underline"
                        >
                          <Smartphone className="h-3 w-3" />
                          {contact.mobile}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(contact.role)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {contact.portal_access && (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="mr-1 h-3 w-3" />
                          Portal
                        </Badge>
                      )}
                      {contact.receives_order_updates ? (
                        <Bell className="h-4 w-4 text-green-600" />
                      ) : (
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          disabled={deletingId === contact.id}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(contact)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDelete(contact.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContactDialog
        customerId={customerId}
        contact={editingContact}
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
      />
    </>
  )
}