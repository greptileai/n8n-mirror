import { LicenseState, Logger } from '@n8n/backend-common';
import { mockInstance, mockLogger, testDb, testModules } from '@n8n/backend-test-utils';
import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';

import { ExternalSecretsProviders } from '@/modules/external-secrets.ee/external-secrets-providers.ee';
import { ExternalSecretsConfig } from '@/modules/external-secrets.ee/external-secrets.config';

import {
	AnotherDummyProvider,
	createDummyProvider,
	DummyProvider,
	MockProviders,
} from '../../shared/external-secrets/utils';
import { createOwner } from '../shared/db/users';
import type { SuperAgentTest } from '../shared/types';
import { setupTestServer } from '../shared/utils';
import { Response } from 'superagent';
import { SecretProviderTypeResponse, SecretsProviderType } from '@n8n/api-types';

const mockProvidersInstance = new MockProviders();
mockInstance(ExternalSecretsProviders, mockProvidersInstance);

const licenseMock = mock<LicenseState>();
licenseMock.isLicensed.mockReturnValue(true);
Container.set(LicenseState, licenseMock);

mockInstance(ExternalSecretsConfig, {
	externalSecretsForProjects: false,
	updateInterval: 300,
	preferGet: false,
});

describe('Secret Providers Types API', () => {
	const testServer = setupTestServer({
		endpointGroups: ['externalSecrets'],
		enabledFeatures: ['feat:externalSecrets'],
		modules: ['external-secrets'],
	});

	let ownerAgent: SuperAgentTest;

	beforeAll(async () => {
		await testModules.loadModules(['external-secrets']);
		await testDb.init();

		Container.set(Logger, mockLogger());

		const owner = await createOwner();
		ownerAgent = testServer.authAgentFor(owner);
	});

	afterAll(async () => {
		await testDb.terminate();
	});

	beforeAll(async () => {
		const config = Container.get(ExternalSecretsConfig);
		config.externalSecretsForProjects = true;
	});

	describe('GET /secret-providers/types', () => {
		describe('Authorization', () => {
			it.todo('should authorize owner to list provider types');
			it.todo('should authorize global admin to list provider types');
			it.todo('should refuse member to list provider types');
		});

		describe('with providers', () => {
			const mockProvider = createDummyProvider({
				name: 'mock_provider',
				displayName: 'Mock Provider Custom',
				properties: [
					{
						name: 'apiKey',
						displayName: 'API Key',
						type: 'string',
						default: '',
						required: true,
						typeOptions: {
							password: true,
						},
					},
					{
						name: 'region',
						displayName: 'Region',
						type: 'options',
						default: 'us-east-1',
						options: [
							{ name: 'US East', value: 'us-east-1' },
							{ name: 'US West', value: 'us-west-2' },
							{ name: 'EU Central', value: 'eu-central-1' },
						],
						required: false,
					},
					{
						name: 'projectId',
						displayName: 'Project ID',
						type: 'string',
						default: '',
						required: false,
					},
					{
						name: 'environment',
						displayName: 'Environment',
						type: 'string',
						default: 'production',
						required: false,
					},
				],
			});

			let response: Response;

			beforeAll(async () => {
				mockProvidersInstance.setProviders({
					dummy: DummyProvider,
					another_dummy: AnotherDummyProvider,
					mock_provider: mockProvider,
				});

				response = await ownerAgent.get('/secret-providers/types');
			});

			it('should return all available provider types when providers exist', async () => {
				const { data } = response.body as { data: SecretProviderTypeResponse[] };
				expect(response.status).toBe(200);
				expect(data).toBeInstanceOf(Array);
				expect(data).toHaveLength(3);

				const providerNames = data.map((p) => p.type);
				expect(providerNames).toEqual(
					expect.arrayContaining(['dummy', 'another_dummy', 'mock_provider']),
				);
			});

			it('should return correct provider data', () => {
				const { data } = response.body as { data: SecretProviderTypeResponse[] };

				const expectedMockProvider = data.find(
					(p) => p.type === ('mock_provider' as SecretsProviderType),
				);
				expect(expectedMockProvider).toBeDefined();
				expect(expectedMockProvider?.displayName).toBe('Mock Provider Custom');
				expect(expectedMockProvider?.properties).toHaveLength(4);

				const propertiesNames = expectedMockProvider?.properties?.map((p) => p.name);
				expect(propertiesNames).toEqual(
					expect.arrayContaining(['apiKey', 'region', 'projectId', 'environment']),
				);
			});
		});

		describe('without providers', () => {
			it.todo('should return empty array when no providers are registered');
		});
	});

	describe('GET /secret-providers/types/:type', () => {
		describe('Authorization', () => {
			it.todo('should authorize owner to get specific provider type');
			it.todo('should authorize global admin to get specific provider type');
			it.todo('should refuse member to get provider type');
		});

		describe('with provider', () => {
			beforeAll(async () => {
				// call the endpoint
			});

			it.todo('should return provider type details for valid existing type');
			it.todo('should return correct structure with type, displayName, icon, and properties');
			it.todo('should return provider-specific properties matching the provider');
		});

		describe('without provider', () => {
			beforeAll(async () => {
				// call the endpoint
			});

			it.todo('should return 404 for non-existent provider type');
			it.todo('should return 404 with appropriate error message');
		});
	});
});
