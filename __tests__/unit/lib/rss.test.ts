import { generateRssFeed } from '@/lib/rss'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

// Mock fs module
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn(),
}))

// Mock contentlayer with a simpler approach
jest.mock('contentlayer2/generated', () => ({
  allPosts: [
    {
      _id: 'post-1',
      published: true,
      date: '2024-01-01',
      title: 'Test Post 1',
      description: 'Test description 1',
      url: '/blog/test-post-1',
      categories: ['test'],
      authors: ['Author 1'],
    },
    {
      _id: 'post-2',
      published: true,
      date: '2024-01-02',
      title: 'Test Post 2',
      description: 'Test description 2',
      url: '/blog/test-post-2',
      categories: ['test', 'example'],
      authors: ['Author 2'],
    },
    {
      _id: 'post-3',
      published: false, // Should be filtered out
      date: '2024-01-03',
      title: 'Unpublished Post',
      description: 'This should not appear',
      url: '/blog/unpublished',
    },
    {
      _id: 'post-4',
      published: true,
      date: '2024-01-04',
      title: 'Post 4',
      description: 'Description 4',
      url: '/blog/post-4',
      // Missing categories and authors - should still work
    },
  ],
}))

// Mock RSS library
const mockFeed = {
  item: jest.fn(),
  xml: jest.fn().mockReturnValue('<rss>test</rss>'),
}

jest.mock('rss', () => {
  return jest.fn().mockImplementation(() => mockFeed)
})

describe('RSS Feed Generation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.NEXT_PUBLIC_APP_URL = 'https://truthsource.io'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateRssFeed', () => {
    it('should generate RSS feed successfully', async () => {
      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      await generateRssFeed()

      expect(mockFeed.item).toHaveBeenCalledTimes(3) // Only published posts
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('public/rss.xml'),
        '<rss>test</rss>'
      )
    })

    it('should create public directory if it does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      await generateRssFeed()

      expect(mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('public'),
        { recursive: true }
      )
    })

    it('should filter out unpublished posts', async () => {
      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      await generateRssFeed()

      // Should only call item() for published posts
      expect(mockFeed.item).toHaveBeenCalledTimes(3)
      
      // Verify the calls were for published posts only
      const calls = (mockFeed.item as jest.Mock).mock.calls
      expect(calls.some(call => call[0].title === 'Unpublished Post')).toBe(false)
    })

    it('should sort posts by date (newest first)', async () => {
      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      await generateRssFeed()

      const calls = (mockFeed.item as jest.Mock).mock.calls
      expect(calls[0][0].title).toBe('Post 4') // Latest date
      expect(calls[1][0].title).toBe('Test Post 2')
      expect(calls[2][0].title).toBe('Test Post 1')
    })

    it('should limit to 20 posts', async () => {
      // Mock more than 20 posts
      jest.doMock('contentlayer2/generated', () => ({
        allPosts: Array.from({ length: 25 }, (_, i) => ({
          _id: `post-${i}`,
          published: true,
          date: `2024-01-${String(i + 1).padStart(2, '0')}`,
          title: `Post ${i}`,
          description: `Description ${i}`,
          url: `/blog/post-${i}`,
        })),
      }))

      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      await generateRssFeed()

      expect(mockFeed.item).toHaveBeenCalledTimes(20)
    })

    it('should handle missing optional fields gracefully', async () => {
      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      await generateRssFeed()

      // Should still work with posts that have missing categories/authors
      const calls = (mockFeed.item as jest.Mock).mock.calls
      const post4Call = calls.find(call => call[0].title === 'Post 4')
      expect(post4Call).toBeDefined()
      expect(post4Call[0].categories).toEqual([])
      expect(post4Call[0].author).toBe('')
    })

    it('should validate site URL format', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'invalid-url'

      await expect(generateRssFeed()).rejects.toThrow('Invalid site URL: invalid-url')
    })

    it('should use default URL when NEXT_PUBLIC_APP_URL is not set', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL
      ;(existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      await generateRssFeed()

      // Should use default URL
      expect(mockFeed.xml).toHaveBeenCalled()
    })

    it('should handle file write errors', async () => {
      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      await expect(generateRssFeed()).rejects.toThrow('Failed to write RSS feed: Permission denied')
    })

    it('should handle RSS item creation errors gracefully', async () => {
      // Mock a post that will cause an error when added to RSS
      jest.doMock('contentlayer2/generated', () => ({
        allPosts: [
          {
            _id: 'error-post',
            published: true,
            date: '2024-01-01',
            title: 'Error Post',
            description: 'This will cause an error',
            url: '/blog/error-post',
          },
        ],
      }))

      (mockFeed.item as jest.Mock).mockImplementation(() => {
        throw new Error('RSS item error')
      })

      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      // Should not throw, but should log the error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      await generateRssFeed()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to add post to RSS feed: error-post',
        expect.any(Error)
      )
    })

    it('should validate post dates', async () => {
      jest.doMock('contentlayer2/generated', () => ({
        allPosts: [
          {
            _id: 'invalid-date-post',
            published: true,
            date: 'invalid-date',
            title: 'Invalid Date Post',
            description: 'This has an invalid date',
            url: '/blog/invalid-date',
          },
        ],
      }))

      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      
      await generateRssFeed()

      expect(consoleSpy).toHaveBeenCalledWith('Invalid date for post: invalid-date-post')
      expect(mockFeed.item).not.toHaveBeenCalled()
    })

    it('should warn about posts with missing required fields', async () => {
      jest.doMock('contentlayer2/generated', () => ({
        allPosts: [
          {
            _id: 'incomplete-post',
            published: true,
            // Missing date, title, description, url
          },
        ],
      }))

      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      
      await generateRssFeed()

      expect(consoleSpy).toHaveBeenCalledWith('Skipping invalid post: incomplete-post')
      expect(mockFeed.item).not.toHaveBeenCalled()
    })

    it('should create RSS feed with correct configuration', async () => {
      (existsSync as jest.Mock).mockReturnValue(true)
      ;(writeFileSync as jest.Mock).mockImplementation(() => {})

      await generateRssFeed()

      // Verify RSS constructor was called with correct config
      const RSS = require('rss')
      expect(RSS).toHaveBeenCalledWith({
        title: 'TruthSource Blog',
        description: 'Insights on B2B e-commerce, inventory management, and data accuracy',
        feed_url: 'https://truthsource.io/rss.xml',
        site_url: 'https://truthsource.io',
        image_url: 'https://truthsource.io/logo.png',
        language: 'en',
        pubDate: expect.any(String),
      })
    })
  })
})