import { Container } from '@n8n/di';

import { QuickConnectModule } from '../quick-connect.module';

describe('QuickConnectModule', () => {
	let module: QuickConnectModule;

	beforeEach(() => {
		Container.reset();
		module = new QuickConnectModule();
	});

	afterEach(() => {
		delete process.env.N8N_QUICK_CONNECT_OPTIONS;
	});

	describe('settings()', () => {
		it('should not expose backendFlowConfig.secret', async () => {
			const testConfig = [
				{
					packageName: '@n8n/test-service',
					credentialType: 'testApi',
					text: 'Test Service Integration',
					quickConnectType: 'backend',
					serviceName: 'Test Service',
					backendFlowConfig: {
						secret: 'super-secret-key-that-should-never-be-exposed',
						consentText: 'Allow access to your account?',
					},
				},
			];
			process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

			const settings = await module.settings();

			expect(settings.options).toHaveLength(1);
			expect(settings.options[0].backendFlowConfig?.secret).toBeUndefined();
		});

		it('should preserve backendFlowConfig.consentText', async () => {
			const testConfig = [
				{
					packageName: '@n8n/test-service',
					credentialType: 'testApi',
					text: 'Test Service Integration',
					quickConnectType: 'backend',
					serviceName: 'Test Service',
					backendFlowConfig: {
						secret: 'secret-key',
						consentText: 'Allow access to your account?',
					},
				},
			];
			process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

			const settings = await module.settings();

			expect(settings.options[0].backendFlowConfig?.consentText).toBe(
				'Allow access to your account?',
			);
		});

		it('should return empty options when no config is set', async () => {
			const settings = await module.settings();

			expect(settings.options).toEqual([]);
		});

		it('should handle options without backendFlowConfig', async () => {
			const testConfig = [
				{
					packageName: '@n8n/oauth-service',
					credentialType: 'oauthApi',
					text: 'OAuth Service Integration',
					quickConnectType: 'oauth',
					serviceName: 'OAuth Service',
				},
			];
			process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

			const settings = await module.settings();

			expect(settings.options).toHaveLength(1);
			expect(settings.options[0].backendFlowConfig).toBeUndefined();
			expect(settings.options[0].packageName).toBe('@n8n/oauth-service');
		});

		it('should handle mixed options with and without backendFlowConfig', async () => {
			const testConfig = [
				{
					packageName: '@n8n/backend-service',
					credentialType: 'backendApi',
					text: 'Backend Service Integration',
					quickConnectType: 'backend',
					serviceName: 'Backend Service',
					backendFlowConfig: {
						secret: 'secret-that-must-be-hidden',
						consentText: 'Grant access?',
					},
				},
				{
					packageName: '@n8n/frontend-service',
					credentialType: 'frontendApi',
					text: 'Frontend Service Integration',
					quickConnectType: 'oauth',
					serviceName: 'Frontend Service',
				},
			];
			process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

			const settings = await module.settings();

			expect(settings.options).toHaveLength(2);
			expect(settings.options[0].backendFlowConfig?.secret).toBeUndefined();
			expect(settings.options[0].backendFlowConfig?.consentText).toBe('Grant access?');
			expect(settings.options[1].backendFlowConfig).toBeUndefined();
		});

		it('should return all non-sensitive option fields', async () => {
			const testConfig = [
				{
					packageName: '@n8n/test-service',
					credentialType: 'testApi',
					text: 'Test Service Integration',
					quickConnectType: 'backend',
					serviceName: 'Test Service',
					backendFlowConfig: {
						secret: 'secret-key',
					},
				},
			];
			process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

			const settings = await module.settings();

			const option = settings.options[0];
			expect(option.packageName).toBe('@n8n/test-service');
			expect(option.credentialType).toBe('testApi');
			expect(option.text).toBe('Test Service Integration');
			expect(option.quickConnectType).toBe('backend');
			expect(option.serviceName).toBe('Test Service');
		});

		it('should strip secret from multiple options with backendFlowConfig', async () => {
			const testConfig = [
				{
					packageName: '@n8n/service-1',
					credentialType: 'api1',
					text: 'Service 1',
					quickConnectType: 'backend',
					serviceName: 'Service One',
					backendFlowConfig: {
						secret: 'secret-1',
						consentText: 'Consent 1',
					},
				},
				{
					packageName: '@n8n/service-2',
					credentialType: 'api2',
					text: 'Service 2',
					quickConnectType: 'backend',
					serviceName: 'Service Two',
					backendFlowConfig: {
						secret: 'secret-2',
						consentText: 'Consent 2',
					},
				},
			];
			process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);

			const settings = await module.settings();

			expect(settings.options).toHaveLength(2);
			expect(settings.options[0].backendFlowConfig?.secret).toBeUndefined();
			expect(settings.options[1].backendFlowConfig?.secret).toBeUndefined();
			expect(settings.options[0].backendFlowConfig?.consentText).toBe('Consent 1');
			expect(settings.options[1].backendFlowConfig?.consentText).toBe('Consent 2');
		});
	});
});
