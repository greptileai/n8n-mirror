import { defineConfig } from 'eslint/config';
import { nodeConfig } from '@n8n/eslint-config/node';

export default defineConfig(
	nodeConfig,
	{
		rules: {
			'unicorn/filename-case': ['error', { case: 'kebabCase' }],
		},
	},
	{
		files: ['**/*.config.ts'],
		rules: {
			'n8n-local-rules/no-untyped-config-class-field': 'error',
		},
	},
);
