// Mock for isows module
module.exports = {
  getNativeWebSocket: () => null,
  WebSocket: class MockWebSocket {},
}