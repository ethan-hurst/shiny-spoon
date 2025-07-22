'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Award,
  Edit,
  MoreHorizontal,
  Percent,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { deleteTier } from '@/app/actions/tiers'
import { TierDialog } from './tier-dialog'

interface Tier {
  id: string
  name: string
  level: number
  discount_percentage: number
  benefits: any
  requirements: any
  color: string
  customer_count: number
}

interface TierListProps {
  tiers: Tier[]
  organizationId: string
}

export function TierList({ tiers, organizationId }: TierListProps) {
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<Tier | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleEdit = (tier: Tier) => {
    setEditingTier(tier)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string, customerCount: number) => {
    if (customerCount > 0) {
      toast.error(`Cannot delete tier with ${customerCount} assigned customers`)
      return
    }

    if (!confirm('Are you sure you want to delete this tier?')) {
      return
    }

    setDeletingId(id)
    try {
      const result = await deleteTier(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Tier deleted successfully')
        router.refresh()
      }
    } catch (error) {
      toast.error('Failed to delete tier')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingTier(null)
  }

  if (tiers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Tiers Configured</CardTitle>
          <CardDescription>
            Create your first customer tier to offer different pricing and
            benefits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Award className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Tiers help you segment customers and offer tailored pricing
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Tier
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
              <CardTitle>Customer Tiers</CardTitle>
              <CardDescription>
                Configure pricing tiers and benefits for different customer
                segments
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Benefits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: tier.color }}
                      />
                      <span className="font-medium">{tier.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Level {tier.level}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      {tier.discount_percentage}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {tier.customer_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    {tier.benefits && Object.keys(tier.benefits).length > 0 ? (
                      <div className="text-sm">
                        {Object.entries(tier.benefits)
                          .slice(0, 2)
                          .map(([key, value]) => (
                            <div key={key} className="text-muted-foreground">
                              {key.replace(/_/g, ' ')}: {String(value)}
                            </div>
                          ))}
                        {Object.keys(tier.benefits).length > 2 && (
                          <span className="text-muted-foreground text-xs">
                            +{Object.keys(tier.benefits).length - 2} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        No benefits configured
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={deletingId === tier.id}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(tier)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            handleDelete(tier.id, tier.customer_count)
                          }
                          disabled={tier.customer_count > 0}
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

      <TierDialog
        tier={editingTier}
        organizationId={organizationId}
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        existingLevels={tiers
          .map((t) => t.level)
          .filter((l) => l !== editingTier?.level)}
      />
    </>
  )
}
