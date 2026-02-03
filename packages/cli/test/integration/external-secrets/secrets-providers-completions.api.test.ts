import { LicenseState, Logger } from '@n8n/backend-common';
import { createTeamProject, mockInstance, mockLogger, testDb } from '@n8n/backend-test-utils';
import type { Project, User } from '@n8n/db';
import {
	ProjectSecretsProviderAccessRepository,
	SecretsProviderConnectionRepository,
} from '@n8n/db';
import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';

import { ExternalSecretsManager } from '@/modules/external-secrets.ee/external-secrets-manager.ee';
import { ExternalSecretsProviders } from '@/modules/external-secrets.ee/external-secrets-providers.ee';
import { ExternalSecretsConfig } from '@/modules/external-secrets.ee/external-secrets.config';

import { createDummyProvider, MockProviders } from '../../shared/external-secrets/utils';
import { createAdmin, createMember, createOwner } from '../shared/db/users';
import type { SuperAgentTest } from '../shared/types';
import { setupTestServer } from '../shared/utils';
import { Cipher } from 'n8n-core';
import { mockCipher } from '@test/mocking';

const resetManager = async () => {
	const manager = Container.get(ExternalSecretsManager);
	manager.shutdown();
	await manager.init();
};

const mockProvidersInstance = new MockProviders();
mockInstance(ExternalSecretsProviders, mockProvidersInstance);

const licenseMock = mock<LicenseState>();
licenseMock.isLicensed.mockReturnValue(true);
Container.set(LicenseState, licenseMock);

mockInstance(ExternalSecretsConfig, {
	externalSecretsForProjects: true,
});

mockInstance(Cipher, mockCipher());

describe('Secret Providers Completions API', () => {
	let owner: User;
	let member: User;
	let admin: User;
	let authOwnerAgent: SuperAgentTest;
	let authAdminAgent: SuperAgentTest;
	let authMemberAgent: SuperAgentTest;

	const testServer = setupTestServer({
		endpointGroups: ['externalSecrets'],
		enabledFeatures: ['feat:externalSecrets'],
		modules: ['external-secrets'],
	});

	let connectionRepository: SecretsProviderConnectionRepository;
	let projectAccessRepository: ProjectSecretsProviderAccessRepository;

	let projectWithConnections: Project;
	let projectWithoutConnections: Project;

	beforeAll(async () => {
		Container.set(Logger, mockLogger());

		owner = await createOwner();
		member = await createMember();
		admin = await createAdmin();

		authOwnerAgent = testServer.authAgentFor(owner);
		authAdminAgent = testServer.authAgentFor(admin);
		authMemberAgent = testServer.authAgentFor(member);

		connectionRepository = Container.get(SecretsProviderConnectionRepository);
		projectAccessRepository = Container.get(ProjectSecretsProviderAccessRepository);

		projectWithConnections = await createTeamProject('With Connections', owner);
		projectWithoutConnections = await createTeamProject('Without Connections', owner);
	});

	beforeEach(async () => {
		await testDb.truncate(['SecretsProviderConnection', 'ProjectSecretsProviderAccess']);
	});

	describe('GET /secret-providers/completions/secrets/global', () => {
		describe('Authorisation', () => {
			it('should authorize owner to list global secrets', async () => {
				const response = await authOwnerAgent.get('/secret-providers/completions/secrets/global');
				expect(response.status).toBe(200);
			});

			it('should authorize global admin to list global secrets', async () => {
				const response = await authAdminAgent.get('/secret-providers/completions/secrets/global');
				expect(response.status).toBe(200);
			});

			it('should refuse member to list global secrets', async () => {
				const response = await authMemberAgent.get('/secret-providers/completions/secrets/global');
				expect(response.status).toBe(403);
			});
		});

		describe('with global connections', () => {
			it('should return global secrets', async () => {
				const TestProvider = createDummyProvider({
					name: 'global_test_provider',
					secrets: { globalSecret1: 'value1', globalSecret2: 'value2' },
				});

				mockProvidersInstance.setProviders({
					global_test_provider: TestProvider,
				});

				// Create a global connection (no project access)
				await connectionRepository.save(
					connectionRepository.create({
						providerKey: 'global-connection',
						type: 'global_test_provider',
						isEnabled: true,
						encryptedSettings: JSON.stringify({ mocked: 'mocked-encrypted-settings' }),
					}),
				);

				await resetManager();

				const response = await authOwnerAgent
					.get('/secret-providers/completions/secrets/global')
					.expect(200);

				expect(response.body.data).toEqual({
					'global-connection': ['globalSecret1', 'globalSecret2'],
				});
			});
		});

		describe('without global connections', () => {
			it('should return an empty object', async () => {
				await resetManager();

				const response = await authOwnerAgent
					.get('/secret-providers/completions/secrets/global')
					.expect(200);

				expect(response.body.data).toEqual({});
			});
		});
	});

	describe('GET /secret-providers/completions/secrets/project/:projectId', () => {
		describe('Authorisation', () => {
			it('should authorize owner to list project secrets', async () => {
				const response = await authOwnerAgent.get(
					'/secret-providers/completions/secrets/project/123',
				);
				expect(response.status).toBe(200);
			});

			it('should authorize global admin to list project secrets', async () => {
				const response = await authAdminAgent.get(
					'/secret-providers/completions/secrets/project/123',
				);
				expect(response.status).toBe(200);
			});

			it('should refuse member to list project secrets', async () => {
				const response = await authMemberAgent.get(
					'/secret-providers/completions/secrets/project/123',
				);
				expect(response.status).toBe(403);
			});
		});

		describe('with existing project connections', () => {
			it('should return project secrets', async () => {
				const TestProvider = createDummyProvider({
					name: 'test_provider',
					secrets: { secret1: 'value1', secret2: 'value2' },
				});
				const AnotherTestProvider = createDummyProvider({
					name: 'another_test_provider',
					secrets: { secret3: 'value3', secret4: 'value4' },
				});

				mockProvidersInstance.setProviders({
					test_provider: TestProvider,
					another_test_provider: AnotherTestProvider,
				});

				// Create a project-scoped connection for projectWithConnections
				const mockConnection = {
					providerKey: 'test-project-secret-connection',
					type: 'test_provider',
					isEnabled: true,
					encryptedSettings: JSON.stringify({ mocked: 'mocked-encrypted-settings' }),
				};
				const connection = await connectionRepository.save(
					connectionRepository.create(mockConnection),
				);

				await connectionRepository.save(
					connectionRepository.create({
						providerKey: 'test-project-secret-connection-disabled',
						type: 'another_test_provider',
						isEnabled: false,
						encryptedSettings: JSON.stringify({ mocked: 'mocked-encrypted-settings' }),
					}),
				);

				await projectAccessRepository.save(
					projectAccessRepository.create({
						projectId: projectWithConnections.id,
						secretsProviderConnectionId: connection.id,
					}),
				);

				await resetManager();

				const response = await authOwnerAgent
					.get(`/secret-providers/completions/secrets/project/${projectWithConnections.id}`)
					.expect(200);

				expect(response.body.data).toEqual({
					'test-project-secret-connection': ['secret1', 'secret2'],
				});
			});
		});

		describe('with no project connections', () => {
			it('should return an empty object', async () => {
				await resetManager();

				const response = await authOwnerAgent
					.get(`/secret-providers/completions/secrets/project/${projectWithoutConnections.id}`)
					.expect(200);

				expect(response.body.data).toEqual({});
			});
		});

		describe('with no project', () => {
			it('should return an empty object', async () => {
				await resetManager();

				const nonExistentProjectId = '00000000-0000-0000-0000-000000000000';
				const response = await authOwnerAgent
					.get(`/secret-providers/completions/secrets/project/${nonExistentProjectId}`)
					.expect(200);

				expect(response.body.data).toEqual({});
			});
		});
	});
});
