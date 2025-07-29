// Mock for isows module
module.exports = {
  getNativeWebSocket: () => null,
  WebSocket: class MockWebSocket {},
}

test('placeholder', () => { expect(true).toBe(true) })