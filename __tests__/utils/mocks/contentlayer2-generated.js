module.exports = {
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
}