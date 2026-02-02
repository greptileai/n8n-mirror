/** @type {import('jest').Config} */
const baseConfig = require('../../../jest.config');

module.exports = {
	...baseConfig,
	// Watchman is not available in some sandboxed environments (and is optional for Jest).
	watchman: false,
	// Resolve .js imports to .ts files (ESM-style imports used in evaluations/)
	moduleNameMapper: {
		...baseConfig.moduleNameMapper,
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
};
