// Mock for uncrypto module
module.exports = {
  getRandomValues: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
    return array
  }),
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
  subtle: {
    generateKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  }
} 