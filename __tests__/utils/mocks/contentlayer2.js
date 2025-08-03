// Mock for contentlayer2 module
module.exports = {
  // Add any exports that contentlayer2 provides
  allPosts: [
    {
      _id: 'post-1',
      published: true,
      date: '2024-01-01',
      title: 'Test Post 1',
      description: 'Test description 1',
      url: '/blog/test-post-1',
      categories: ['test'],
      authors: ['Test Author'],
    },
    {
      _id: 'post-2',
      published: true,
      date: '2024-01-02',
      title: 'Test Post 2',
      description: 'Test description 2',
      url: '/blog/test-post-2',
      categories: ['test'],
      authors: ['Test Author'],
    },
    {
      _id: 'post-3',
      published: false,
      date: '2024-01-03',
      title: 'Unpublished Post',
      description: 'This should not appear',
      url: '/blog/unpublished-post',
      categories: ['test'],
      authors: ['Test Author'],
    },
    {
      _id: 'post-4',
      published: true,
      date: '2024-01-04',
      title: 'Post 4',
      description: 'Test description 4',
      url: '/blog/post-4',
      categories: ['test'],
      authors: ['Test Author'],
    },
  ],
}
