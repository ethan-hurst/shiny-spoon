'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'
import { Image as ImageIcon, Upload, X } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ImageUploadProps {
  value?: string | File
  onChange: (value: File | undefined) => void
  disabled?: boolean
}

export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(
    typeof value === 'string' ? value : null
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        onChange(file)
        const reader = new FileReader()

        reader.onloadend = () => {
          setPreview(reader.result as string)
        }

        reader.onerror = (error) => {
          console.error('Error reading file:', error)
          toast.error('Failed to read the selected file')
        }

        reader.readAsDataURL(file)
      }
    },
    [onChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
    disabled,
  })

  const removeImage = () => {
    onChange(undefined)
    setPreview(null)
  }

  if (preview) {
    return (
      <div className="relative inline-block">
        <div className="relative h-40 w-40 overflow-hidden rounded-lg border">
          <Image
            src={preview}
            alt="Product image"
            fill
            className="object-cover"
          />
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 h-6 w-6"
            onClick={removeImage}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2">
        {isDragActive ? (
          <Upload className="h-8 w-8 text-primary" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        )}
        <div className="text-sm">
          {isDragActive ? (
            <p>Drop the image here</p>
          ) : (
            <>
              <p className="font-medium">Click to upload or drag and drop</p>
              <p className="text-muted-foreground">PNG, JPG, WEBP up to 5MB</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
