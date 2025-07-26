'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingDown,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { formatDistanceToNow } from 'date-fns'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { PriceApprovalWithDetails } from '@/types/customer-pricing.types'
import {
  approvePriceChange,
  rejectPriceChange,
} from '@/app/actions/customer-pricing'

interface ApprovalQueueProps {
  approvals: PriceApprovalWithDetails[]
  customerId?: string
}

export function ApprovalQueue({ approvals, customerId }: ApprovalQueueProps) {
  const queryClient = useQueryClient()
  const [selectedApproval, setSelectedApproval] =
    useState<PriceApprovalWithDetails | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  // Filter approvals by customer if customerId provided
  const filteredApprovals = customerId
    ? approvals.filter((a) => a.customer_id === customerId)
    : approvals

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (approvalId: string) => approvePriceChange(approvalId),
    onSuccess: () => {
      toast.success('Price change approved successfully')
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to approve price change')
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ approvalId, reason }: { approvalId: string; reason: string }) =>
      rejectPriceChange(approvalId, reason),
    onSuccess: () => {
      toast.success('Price change rejected')
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setShowRejectDialog(false)
      setRejectionReason('')
      setSelectedApproval(null)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to reject price change')
    },
  })

  const handleApprove = (approval: PriceApprovalWithDetails) => {
    approveMutation.mutate(approval.id)
  }

  const handleReject = () => {
    if (!selectedApproval || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    rejectMutation.mutate({
      approvalId: selectedApproval.id,
      reason: rejectionReason,
    })
  }

  if (filteredApprovals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No pending approvals</h3>
        <p className="text-sm text-muted-foreground">
          All price changes have been reviewed
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filteredApprovals.map((approval) => (
        <Card key={approval.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">
                  {approval.products?.name} ({approval.products?.sku})
                </CardTitle>
                <CardDescription>
                  {approval.customers?.display_name ||
                    approval.customers?.company_name}
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(approval.requested_at), {
                  addSuffix: true,
                })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Price change details */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Price</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(approval.current_price || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requested Price</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(approval.requested_price || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Impact</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      (approval.discount_percent || 0) > 20
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    <TrendingDown className="h-3 w-3 mr-1" />
                    {formatPercent(approval.discount_percent || 0)} discount
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Reason and metadata */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Reason for Change</p>
                <p className="text-sm text-muted-foreground">
                  {approval.change_reason}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Requested by {approval.requested_by_user?.email}
                </div>
                {(approval.margin_percent || 0) < 15 && (
                  <Badge
                    variant="outline"
                    className="text-xs text-destructive border-destructive"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Low margin: {formatPercent(approval.margin_percent || 0)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => handleApprove(approval)}
                disabled={approveMutation.isPending && approveMutation.variables === approval.id}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedApproval(approval)
                  setShowRejectDialog(true)
                }}
                disabled={rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  router.push(
                    `/customers/${approval.customer_id}/pricing?highlight=${approval.product_id}`
                  )
                }
              >
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Rejection dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Price Change</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this price change request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this price change is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false)
                setRejectionReason('')
                setSelectedApproval(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              Reject Price Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}