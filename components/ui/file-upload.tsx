'use client'

import { forwardRef, useRef, useState } from 'react'
import { Cloud, File, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  accept?: string
  maxSize?: number // in bytes
  onChange?: (file: File | null) => void
  value?: File | null
  disabled?: boolean
  className?: string
  placeholder?: string
}

export const FileUpload = forwardRef<HTMLInputElement, FileUploadProps>(
  ({ 
    accept, 
    maxSize = 10 * 1024 * 1024, // 10MB default
    onChange, 
    value, 
    disabled, 
    className,
    placeholder = "Click to upload or drag and drop"
  }, ref) => {
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = async (file: File) => {
      setIsUploading(true)
      
      try {
        // Validate file size
        if (file.size > maxSize) {
          throw new Error(`File size exceeds ${formatFileSize(maxSize)} limit`)
        }

        // Validate file type if accept is specified
        if (accept && !accept.split(',').some(type => {
          const trimmed = type.trim()
          if (trimmed.startsWith('.')) {
            return file.name.toLowerCase().endsWith(trimmed.toLowerCase())
          }
          // Properly escape special regex characters and handle wildcards
          const regexPattern = trimmed
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\*/g, '.*') // Replace wildcards
          return file.type.match(new RegExp(`^${regexPattern}$`))
        })) {
          throw new Error(`File type not supported. Accepted types: ${accept}`)
        }

        setError(null)
        onChange?.(file)
      } catch (error) {
        console.error('File upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
        setError(errorMessage)
        onChange?.(null)
      } finally {
        setIsUploading(false)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null
      if (file) {
        handleFileSelect(file)
      } else {
        onChange?.(null)
      }
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      
      if (disabled) return
      
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileSelect(file)
      }
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) {
        setIsDragOver(true)
      }
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
    }

    const handleClick = () => {
      if (!disabled) {
        inputRef.current?.click()
      }
    }

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange?.(null)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }

    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
      <div className={cn("w-full", className)}>
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer",
            "hover:border-primary/50 hover:bg-primary/5",
            "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
            isDragOver && "border-primary bg-primary/10",
            disabled && "opacity-50 cursor-not-allowed",
            value && "border-primary bg-primary/5"
          )}
        >
          <input
            ref={ref || inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            disabled={disabled}
            className="sr-only"
          />

          {isUploading ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : value ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <File className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {value.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(value.size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove file</span>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Cloud className={cn(
                "h-10 w-10 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {placeholder}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {accept && `Accepts: ${accept}`}
                  {maxSize && ` • Max size: ${formatFileSize(maxSize)}`}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-2 text-sm text-destructive flex items-center gap-2">
            <X className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    )
  }
)

FileUpload.displayName = "FileUpload"