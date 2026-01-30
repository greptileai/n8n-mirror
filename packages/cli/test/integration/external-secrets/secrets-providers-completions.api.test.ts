import { LicenseState } from '@n8n/backend-common';
import { createTeamProject, mockInstance, testDb } from '@n8n/backend-test-utils';
import type { Project, User } from '@n8n/db';
import {
	ProjectSecretsProviderAccessRepository,
	SecretsProviderConnectionRepository,
} from '@n8n/db';
import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';

import { ExternalSecretsProviders } from '@/modules/external-secrets.ee/external-secrets-providers.ee';
import { ExternalSecretsConfig } from '@/modules/external-secrets.ee/external-secrets.config';

import {
	AnotherDummyProvider,
	DummyProvider,
	MockProviders,
} from '../../shared/external-secrets/utils';
import { createAdmin, createMember, createOwner } from '../shared/db/users';
import type { SuperAgentTest } from '../shared/types';
import { setupTestServer } from '../shared/utils';

let owner: User;
let member: User;
let admin: User;
let authOwnerAgent: SuperAgentTest;
let authAdminAgent: SuperAgentTest;
let authMemberAgent: SuperAgentTest;

const mockProvidersInstance = new MockProviders();
mockInstance(ExternalSecretsProviders, mockProvidersInstance);

const licenseMock = mock<LicenseState>();
licenseMock.isLicensed.mockReturnValue(true);
Container.set(LicenseState, licenseMock);

const testServer = setupTestServer({
	endpointGroups: ['externalSecrets'],
	enabledFeatures: ['feat:externalSecrets'],
	modules: ['external-secrets'],
});

let connectionRepository: SecretsProviderConnectionRepository;
let projectAccessRepository: ProjectSecretsProviderAccessRepository;
let externalSecretsConfig: ExternalSecretsConfig;

let projectWithConnections: Project;
let projectWithoutConnections: Project;

beforeAll(async () => {
	mockProvidersInstance.setProviders({
		dummy: DummyProvider,
		another_dummy: AnotherDummyProvider,
	});

	externalSecretsConfig = Container.get(ExternalSecretsConfig);
	externalSecretsConfig.externalSecretsForProjects = true;

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
	describe('with owner', () => {
		it('should return global secrets', async () => {
			// TODO: Add API call to test the endpoint
		});

		it('should return empty array when no global connections exist', async () => {});
	});

	describe('with instance admin', () => {
		it('should return global secrets', async () => {});

		it('should return empty array when no global connections exist', async () => {});
	});

	describe('with member', () => {
		it('should not retrieve global secrets', async () => {});
	});

	describe('with unauthenticated user', () => {
		it('should not retrieve global secrets', async () => {
			await testServer.authlessAgent
				.get('/secret-providers/completions/secrets/global')
				.expect(401);
		});
	});
});

describe('GET /secret-providers/completions/secrets/project/:projectId', () => {
	describe('with owner', () => {
		it('should return project secrets', async () => {
			// Create a project-scoped connection for projectWithConnections
			const connection = await connectionRepository.save(
				connectionRepository.create({
					providerKey: 'test-project-secret-connection',
					type: 'dummy',
					isEnabled: true,
					encryptedSettings: JSON.stringify({
						region: 'us-east-1',
						accessKeyId: 'AKIA...',
						secretAccessKey: 'SECRET',
					}),
				}),
			);

			await connectionRepository.save(
				connectionRepository.create({
					providerKey: 'test-project-secret-connection-disabled',
					type: 'another_dummy',
					isEnabled: false,
					encryptedSettings: JSON.stringify({
						region: 'us-east-1',
						accessKeyId: 'AKIA...',
						secretAccessKey: 'SECRET',
					}),
				}),
			);

			await projectAccessRepository.save(
				projectAccessRepository.create({
					projectId: projectWithConnections.id,
					secretsProviderConnectionId: connection.id,
				}),
			);

			const response = await authOwnerAgent
				.get(`/secret-providers/completions/secrets/project/${projectWithConnections.id}`)
				.expect(200);

			expect(response.body.data).toEqual([
				{
					type: 'awsSecretsManager',
					providerKey: 'test-project-secret-connection',
					secretCompletions: ['secret1', 'secret2'],
				},
			]);
		});

		it('should return empty array when project has no connections', async () => {});
	});

	describe('with instance admin', () => {
		it('should return project secrets', async () => {});

		it('should return empty array when project has no connections', async () => {});
	});

	describe('with member', () => {
		it('should not retrieve project secrets', async () => {});
	});

	describe('with unauthenticated user', () => {
		it('should not retrieve project secrets', async () => {
			await testServer.authlessAgent
				.get('/secret-providers/completions/secrets/project/123')
				.expect(401);
		});
	});
});
