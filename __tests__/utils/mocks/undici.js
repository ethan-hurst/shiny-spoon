// Mock for undici module
module.exports = {
  FormData: class MockFormData {
    constructor() {
      this.data = new Map()
    }
    
    append(key, value) {
      this.data.set(key, value)
    }
    
    get(key) {
      return this.data.get(key)
    }
    
    has(key) {
      return this.data.has(key)
    }
  },
  fetch: global.fetch || (() => Promise.resolve(new Response())),
}

test('placeholder', () => { expect(true).toBe(true) })