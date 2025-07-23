const { writeFileSync, mkdirSync, existsSync } = require('fs')
const path = require('path')

// Import the RSS generation function
async function generateRssFeed() {
  // Ensure public directory exists
  const publicDir = path.join(process.cwd(), 'public')
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true })
  }

  try {
    // Import the RSS generation function from the built lib
    const { generateRssFeed: generate } = require('../.next/server/chunks/lib_rss.js')
    await generate()
    console.log('✅ RSS feed generated successfully')
  } catch (error) {
    console.error('❌ Failed to generate RSS feed:', error)
    process.exit(1)
  }
}

// Run the generation
generateRssFeed()