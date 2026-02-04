/**
 * Jest setup file for @n8n/mcp-core tests
 * Cleans up mocks between tests to ensure test isolation
 */

beforeEach(() => {
	jest.clearAllMocks();
});

afterEach(() => {
	jest.restoreAllMocks();
});
