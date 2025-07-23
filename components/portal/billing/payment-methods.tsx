'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { removePaymentMethod } from '@/app/actions/billing'
import { CreditCard, Plus, Trash2, Check } from 'lucide-react'
import type { PaymentMethod } from '@/types/billing.types'

interface PaymentMethodsProps {
  paymentMethods: PaymentMethod[]
  hasActiveSubscription: boolean
}

export function PaymentMethods({ paymentMethods, hasActiveSubscription }: PaymentMethodsProps) {
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null)

  const handleRemove = async () => {
    if (!selectedMethodId) return

    setRemovingId(selectedMethodId)
    try {
      await removePaymentMethod(selectedMethodId)
    } catch (error) {
      console.error('Error removing payment method:', error)
      // TODO: Add toast notification for error
    } finally {
      setRemovingId(null)
      setDeleteDialogOpen(false)
      setSelectedMethodId(null)
    }
  }

  const openDeleteDialog = (methodId: string) => {
    setSelectedMethodId(methodId)
    setDeleteDialogOpen(true)
  }

  const getBrandIcon = (brand?: string) => {
    // In a real app, you'd have actual brand icons
    return <CreditCard className="h-8 w-12" />
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Manage your payment methods for automatic billing
              </CardDescription>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No payment methods added yet
              </p>
              {hasActiveSubscription && (
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-2">
                  Add a payment method to ensure uninterrupted service
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method, index) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {getBrandIcon(method.brand)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : 'Card'} •••• {method.last4 || '****'}
                        </span>
                        {index === 0 && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.exp_month?.toString().padStart(2, '0')}/{method.exp_year}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteDialog(method.id)}
                    disabled={removingId === method.id || (paymentMethods.length === 1 && hasActiveSubscription)}
                  >
                    {removingId === method.id ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {hasActiveSubscription && paymentMethods.length === 1 && (
            <p className="text-xs text-muted-foreground mt-4">
              You must have at least one payment method while you have an active subscription
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment method? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}