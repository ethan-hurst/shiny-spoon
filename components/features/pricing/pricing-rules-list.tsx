'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Copy, Edit, MoreHorizontal, Search, Trash } from 'lucide-react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import {
  formatDiscountDisplay,
  getRuleTypeColor,
  isRuleActive,
  PricingRuleRecord,
} from '@/types/pricing.types'

export function PricingRulesList() {
  const [rules, setRules] = useState<PricingRuleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchRules()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchRules() {
    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select(
          `
          *,
          product:products(name, sku),
          category:product_categories(name),
          customer:customers(name),
          tier:customer_tiers(name)
        `
        )
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setRules(data || [])
    } catch (error) {
      console.error('Error fetching pricing rules:', error)
      toast.error('Failed to load pricing rules')
    } finally {
      setLoading(false)
    }
  }

  async function toggleRuleStatus(ruleId: string, isActive: boolean) {
    try {
      const { error } = await supabase
        .from('pricing_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId)

      if (error) throw error

      setRules(
        rules.map((rule) =>
          rule.id === ruleId ? { ...rule, is_active: isActive } : rule
        )
      )

      toast.success(`Rule ${isActive ? 'activated' : 'deactivated'}`)
    } catch (error) {
      console.error('Error updating rule status:', error)
      toast.error('Failed to update rule status')
    }
  }

  async function duplicateRule(ruleId: string) {
    try {
      const ruleToDuplicate = rules.find((r) => r.id === ruleId)
      if (!ruleToDuplicate) return

      const { id, created_at, updated_at, ...ruleData } = ruleToDuplicate
      const { error } = await supabase.from('pricing_rules').insert({
        ...ruleData,
        name: `${ruleData.name} (Copy)`,
        is_active: false,
      })

      if (error) throw error

      toast.success('Rule duplicated successfully')
      fetchRules()
    } catch (error) {
      console.error('Error duplicating rule:', error)
      toast.error('Failed to duplicate rule')
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return

    try {
      const { error } = await supabase
        .from('pricing_rules')
        .delete()
        .eq('id', ruleId)

      if (error) throw error

      setRules(rules.filter((rule) => rule.id !== ruleId))
      toast.success('Rule deleted successfully')
    } catch (error) {
      console.error('Error deleting rule:', error)
      toast.error('Failed to delete rule')
    }
  }

  // Filter rules based on search and filters
  const filteredRules = rules.filter((rule) => {
    const matchesSearch =
      searchTerm === '' ||
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || rule.rule_type === filterType

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && rule.is_active && isRuleActive(rule)) ||
      (filterStatus === 'inactive' && !rule.is_active) ||
      (filterStatus === 'expired' &&
        rule.end_date &&
        new Date(rule.end_date) < new Date())

    return matchesSearch && matchesType && matchesStatus
  })

  if (loading) {
    return <div className="text-center py-8">Loading pricing rules...</div>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="tier">Tier Discount</SelectItem>
            <SelectItem value="quantity">Quantity Break</SelectItem>
            <SelectItem value="promotion">Promotion</SelectItem>
            <SelectItem value="override">Override</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Rule Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Valid Period</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No pricing rules found
                </TableCell>
              </TableRow>
            ) : (
              filteredRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleRuleStatus(rule.id, checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && (
                        <div className="text-sm text-muted-foreground">
                          {rule.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRuleTypeColor(rule.rule_type)}>
                      {rule.rule_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    {rule.discount_type && rule.discount_value ? (
                      formatDiscountDisplay(
                        rule.discount_type,
                        rule.discount_value
                      )
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {rule.product && <div>Product: {rule.product.name}</div>}
                      {rule.category && (
                        <div>Category: {rule.category.name}</div>
                      )}
                      {rule.customer && (
                        <div>Customer: {rule.customer.name}</div>
                      )}
                      {rule.tier && <div>Tier: {rule.tier.name}</div>}
                      {!rule.product &&
                        !rule.category &&
                        !rule.customer &&
                        !rule.tier && (
                          <span className="text-muted-foreground">
                            All Products
                          </span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {rule.start_date && (
                        <div>
                          From:{' '}
                          {format(new Date(rule.start_date), 'MMM d, yyyy')}
                        </div>
                      )}
                      {rule.end_date && (
                        <div>
                          To: {format(new Date(rule.end_date), 'MMM d, yyyy')}
                        </div>
                      )}
                      {!rule.start_date && !rule.end_date && (
                        <span className="text-muted-foreground">Always</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/pricing/rules/${rule.id}`)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateRule(rule.id)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteRule(rule.id)}
                          className="text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
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
    </div>
  )
}
