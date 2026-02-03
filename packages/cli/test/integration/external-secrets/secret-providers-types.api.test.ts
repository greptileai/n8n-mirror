import { LicenseState, Logger } from '@n8n/backend-common';
import { mockInstance, mockLogger, testDb, testModules } from '@n8n/backend-test-utils';
import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';

import { ExternalSecretsProviders } from '@/modules/external-secrets.ee/external-secrets-providers.ee';
import { ExternalSecretsConfig } from '@/modules/external-secrets.ee/external-secrets.config';

import { DummyProvider, MockProviders } from '../../shared/external-secrets/utils';
import { createOwner } from '../shared/db/users';
import type { SuperAgentTest } from '../shared/types';
import { setupTestServer } from '../shared/utils';

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

	describe('Feature Flag', () => {
		it('should return 400 when externalSecretsForProjects feature is disabled', async () => {
			const config = Container.get(ExternalSecretsConfig);
			config.externalSecretsForProjects = false;

			mockProvidersInstance.setProviders({
				dummy: DummyProvider,
			});

			const response = await ownerAgent.get('/secret-providers/types');

			// TODO: Check why middleware response is 500 instead of 400
			expect(response.status).toBe(400);
			expect(response.body).toEqual({
				code: 400,
				message: 'External secrets for projects feature is not enabled',
			});
		});
	});

	describe('GET /secret-providers/types', () => {
		describe('Authorization', () => {
			it.todo('should authorize owner to list provider types');
			it.todo('should authorize global admin to list provider types');
			it.todo('should refuse member to list provider types');
		});

		describe('with providers', () => {
			beforeAll(async () => {
				// call the endpoint
			});

			it.todo('should return all available provider types when providers exist');
			it.todo('should return multiple provider types when multiple are registered');
			it.todo(
				'should return correct structure with type, displayName, icon, and properties for each provider',
			);
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
