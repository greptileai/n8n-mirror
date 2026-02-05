import { Container } from '@n8n/di';

import { QuickConnectConfig } from '../quick-connect.config';

describe('QuickConnectConfig', () => {
	beforeEach(() => {
		Container.reset();
	});

	afterEach(() => {
		delete process.env.N8N_QUICK_CONNECT_OPTIONS;
	});

	it('returns an empty options array per default', () => {
		const { options } = Container.get(QuickConnectConfig);

		expect(options).toEqual([]);
	});

	it('returns configured options given valid format', () => {
		const testConfig = [
			{
				packageName: '@n8n/superagent',
				credentialType: 'agentApi',
				text: 'Superagent for everyone',
				quickConnectType: 'oauth',
				serviceName: 'Superagent',
			},
		];
		process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

		const { options } = Container.get(QuickConnectConfig);

		expect(options).toEqual(testConfig);
	});

	it('parses valid config with backendFlowConfig', () => {
		const testConfig = [
			{
				packageName: '@n8n/superagent',
				credentialType: 'agentApi',
				text: 'Superagent for everyone',
				quickConnectType: 'backend',
				serviceName: 'Superagent',
				backendFlowConfig: {
					secret: 'my-secret-key',
					consentText: 'Allow access to your account?',
				},
			},
		];
		process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

		const { options } = Container.get(QuickConnectConfig);

		expect(options).toEqual(testConfig);
		expect(options[0].backendFlowConfig?.secret).toBe('my-secret-key');
		expect(options[0].backendFlowConfig?.consentText).toBe('Allow access to your account?');
	});

	it('handles empty JSON array', () => {
		process.env.N8N_QUICK_CONNECT_OPTIONS = '[]';

		const { options } = Container.get(QuickConnectConfig);

		expect(options).toEqual([]);
	});

	it('handles multiple options', () => {
		const testConfig = [
			{
				packageName: '@n8n/superagent',
				credentialType: 'agentApi',
				text: 'Superagent for everyone',
				quickConnectType: 'oauth',
				serviceName: 'Superagent',
			},
			{
				packageName: '@n8n/another-service',
				credentialType: 'anotherApi',
				text: 'Another service integration',
				quickConnectType: 'backend',
				serviceName: 'Another Service',
				backendFlowConfig: {
					secret: 'another-secret',
				},
			},
		];
		process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

		const { options } = Container.get(QuickConnectConfig);

		expect(options).toHaveLength(2);
		expect(options).toEqual(testConfig);
	});

	it.each([
		['invalid JSON string', 'no-json'],
		[
			'missing packageName',
			JSON.stringify([
				{
					credentialType: 'agentApi',
					text: 'Superagent for everyone',
					quickConnectType: 'oauth',
					serviceName: 'Superagent',
				},
			]),
		],
		[
			'missing credentialType',
			JSON.stringify([
				{
					packageName: '@n8n/superagent',
					text: 'Superagent for everyone',
					quickConnectType: 'oauth',
					serviceName: 'Superagent',
				},
			]),
		],
		[
			'missing text',
			JSON.stringify([
				{
					packageName: '@n8n/superagent',
					credentialType: 'agentApi',
					quickConnectType: 'oauth',
					serviceName: 'Superagent',
				},
			]),
		],
		[
			'missing quickConnectType',
			JSON.stringify([
				{
					packageName: '@n8n/superagent',
					credentialType: 'agentApi',
					text: 'Superagent for everyone',
					serviceName: 'Superagent',
				},
			]),
		],
		[
			'missing serviceName',
			JSON.stringify([
				{
					packageName: '@n8n/superagent',
					credentialType: 'agentApi',
					text: 'Superagent for everyone',
					quickConnectType: 'oauth',
				},
			]),
		],
		[
			'backendFlowConfig missing required secret',
			JSON.stringify([
				{
					packageName: '@n8n/superagent',
					credentialType: 'agentApi',
					text: 'Superagent for everyone',
					quickConnectType: 'backend',
					serviceName: 'Superagent',
					backendFlowConfig: {
						consentText: 'Allow access?',
					},
				},
			]),
		],
	])('uses default if configuration is invalid: %s', (_description, config) => {
		process.env.N8N_QUICK_CONNECT_OPTIONS = config;

		const { options } = Container.get(QuickConnectConfig);

		expect(options).toEqual([]);
	});
});
