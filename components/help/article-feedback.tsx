'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { toast } from 'sonner'

interface ArticleFeedbackProps {
  articleId: string
}

export function ArticleFeedback({ articleId }: ArticleFeedbackProps) {
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleHelpfulClick = (isHelpful: boolean) => {
    setHelpful(isHelpful)
    if (!isHelpful) {
      setShowFeedbackForm(true)
    } else {
      // Track positive feedback
      toast.success('Thanks for your feedback!')
      
      // Track analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'article_feedback', {
          event_category: 'help_center',
          event_label: articleId,
          value: 1,
        })
      }
    }
  }

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      toast.error('Please provide some feedback')
      return
    }

    setIsSubmitting(true)
    
    try {
      // In a real app, you'd send this to your backend
      // For now, we'll just simulate it
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast.success('Thank you for your feedback! We\'ll use it to improve our help content.')
      setShowFeedbackForm(false)
      setFeedback('')
      
      // Track analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'article_feedback_detailed', {
          event_category: 'help_center',
          event_label: articleId,
          value: 0,
        })
      }
    } catch (error) {
      toast.error('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (helpful === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Was this article helpful?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => handleHelpfulClick(true)}
              className="flex items-center gap-2"
            >
              <ThumbsUp className="h-4 w-4" />
              Yes
            </Button>
            <Button
              variant="outline"
              onClick={() => handleHelpfulClick(false)}
              className="flex items-center gap-2"
            >
              <ThumbsDown className="h-4 w-4" />
              No
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (showFeedbackForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Help us improve</CardTitle>
          <CardDescription>
            What information were you looking for?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Tell us how we can make this article more helpful..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
          />
          <div className="flex gap-4">
            <Button
              onClick={handleSubmitFeedback}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowFeedbackForm(false)
                setHelpful(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}