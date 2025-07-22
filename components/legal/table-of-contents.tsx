'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Section {
  id: string
  title: string
  level: number
}

interface TableOfContentsProps {
  content?: string
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [activeSection, setActiveSection] = useState<string>('')

  useEffect(() => {
    // Extract headings from the page
    const headings = document.querySelectorAll('h2, h3')
    const sectionList: Section[] = []

    headings.forEach((heading) => {
      const id = heading.id || heading.textContent?.toLowerCase().replace(/\s+/g, '-') || ''
      sectionList.push({
        id,
        title: heading.textContent || '',
        level: parseInt(heading.tagName.charAt(1)),
      })
    })

    setSections(sectionList)
  }, [content])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { threshold: 0.5, rootMargin: '0px 0px -80% 0px' }
    )

    sections.forEach((section) => {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [sections])

  if (sections.length === 0) return null

  return (
    <nav className="mb-8 p-4 bg-gray-50 rounded-lg">
      <h2 className="font-semibold mb-4">Table of Contents</h2>
      <ul className="space-y-2">
        {sections.map((section) => (
          <li
            key={section.id}
            style={{ paddingLeft: `${(section.level - 2) * 1}rem` }}
          >
            <a
              href={`#${section.id}`}
              className={cn(
                'text-sm hover:text-primary transition-colors',
                activeSection === section.id ? 'text-primary font-medium' : 'text-gray-600'
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}