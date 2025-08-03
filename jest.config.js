const nextJest = require('next/jest')

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: './' })

// Any custom config you want to pass to Jest
const customJestConfig = {
  // Test environment
  testEnvironment: 'jest-environment-jsdom',

  // Setup files after environment
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Transform ignore patterns - allow ES modules to be transformed
  transformIgnorePatterns: [
    '/node_modules/(?!(isows|@supabase|ws|undici|geist|contentlayer2|uncrypto)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],

  // Module mapper for problematic ES modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@/types/(.*)$': '<rootDir>/types/$1',
    '^@/utils/(.*)$': '<rootDir>/utils/$1',
    '^isows$': '<rootDir>/__tests__/utils/mocks/isows.js',
    '^undici$': '<rootDir>/__tests__/utils/mocks/undici.js',
    '^geist/font/sans$': '<rootDir>/__tests__/utils/mocks/geist-font.js',
    '^contentlayer2/generated$':
      '<rootDir>/__tests__/utils/mocks/contentlayer2-generated.js',
    '^@contentlayer2/client$':
      '<rootDir>/__tests__/utils/mocks/contentlayer2-client.js',
    '^contentlayer2$': '<rootDir>/__tests__/utils/mocks/contentlayer2.js',
    '^contentlayer2/dist/client/index.js$':
      '<rootDir>/__tests__/utils/mocks/contentlayer2.js',
    '^contentlayer2/client$':
      '<rootDir>/__tests__/utils/mocks/contentlayer2-client.js',
    '^\\.contentlayer/generated$':
      '<rootDir>/__tests__/utils/mocks/contentlayer2-generated.js',
    '^uncrypto$': '<rootDir>/__tests__/utils/mocks/uncrypto.js',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'utils/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/*.config.js',
    '!**/middleware.ts',
  ],

  // Coverage thresholds - temporarily lower for development
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 50,
      statements: 50,
    },
  },

  // Test patterns
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
  ],

  // Exclude mock files and E2E tests from being treated as tests
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/e2e/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/playwright-report/',
    '<rootDir>/__tests__/utils/mocks/',
    '<rootDir>/__tests__/helpers/test-utils.tsx',
  ],

  // Verbose output
  verbose: true,

  // Increase timeout for complex tests
  testTimeout: 30000,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
