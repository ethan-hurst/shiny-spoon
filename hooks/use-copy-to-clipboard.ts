// Shared hook for copying text to clipboard with toast notifications
import { useState, useCallback, useRef, useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface UseCopyToClipboardOptions {
  successMessage?: string
  errorMessage?: string
}

/**
 * Provides a hook for copying text to the clipboard with customizable toast notifications and copy status tracking.
 *
 * @param options - Optional configuration for custom success and error messages in toast notifications.
 * @returns An object containing the `copyToClipboard` function to copy text and an `isCopied` boolean indicating copy status.
 */
export function useCopyToClipboard(options?: UseCopyToClipboardOptions) {
  const [isCopied, setIsCopied] = useState(false)
  const { toast } = useToast()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      
      toast({
        title: 'Copied!',
        description: options?.successMessage || 'Text copied to clipboard',
      })
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Reset after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setIsCopied(false)
        timeoutRef.current = null
      }, 2000)
      
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      
      toast({
        title: 'Copy failed',
        description: options?.errorMessage || 'Failed to copy to clipboard',
        variant: 'destructive',
      })
      
      setIsCopied(false)
      return false
    }
  }, [toast, options?.successMessage, options?.errorMessage])

  return { copyToClipboard, isCopied }
}