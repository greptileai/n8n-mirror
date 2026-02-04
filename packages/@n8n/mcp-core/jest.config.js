/** @type {import('jest').Config} */
module.exports = {
	...require('../../../jest.config'),
	setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts', 'jest-expect-message'],
};
