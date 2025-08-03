'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FeatureHeroProps {
  title: string
  subtitle: string
  videoUrl?: string
  imageUrl?: string
}

export function FeatureHero({
  title,
  subtitle,
  videoUrl,
  imageUrl,
}: FeatureHeroProps) {
  const [videoError, setVideoError] = useState(false)
  const [imageError, setImageError] = useState(false)

  return (
    <section className="relative py-20 lg:py-32 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">{title}</h1>
            <p className="text-xl text-gray-600 mb-8">{subtitle}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup">
                <Button size="lg">Start Free Trial</Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
                  Request Demo
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            {videoUrl && !videoError ? (
              <div className="relative rounded-lg overflow-hidden shadow-2xl bg-gray-900">
                <video
                  className="w-full h-auto"
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-label={`Video demonstration of ${title}`}
                  onError={() => setVideoError(true)}
                >
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  <PlayCircle className="h-16 w-16 text-white" />
                </div>
              </div>
            ) : imageUrl && !imageError ? (
              <img
                src={imageUrl}
                alt={`Detailed view of ${title} interface showing key features and functionality`}
                className="rounded-lg shadow-2xl w-full"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="aspect-video bg-gray-200 rounded-lg shadow-2xl flex items-center justify-center">
                <p className="text-gray-500">Media content unavailable</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
