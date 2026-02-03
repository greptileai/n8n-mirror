import { Container } from '@n8n/di';
import { createOwner } from '@test-integration/db/users';
import type { SuperAgentTest } from '@test-integration/types';
import * as utils from '@test-integration/utils';

const testServer = utils.setupTestServer({
	endpointGroups: ['quick-connect'],
	modules: ['quick-connect'],
});

let authOwnerAgent: SuperAgentTest;

beforeAll(async () => {
	const owner = await createOwner();
	authOwnerAgent = testServer.authAgentFor(owner);
});

describe('GET /quick-connect', () => {
	const testConfig = [
		{
			packageName: '@n8n/superagent',
			credentialType: 'agentApi',
			text: 'Superagent for everyone',
			quickConnectType: 'oauth',
		},
	];

	beforeEach(() => {
		// Set the environment variable for the test
		process.env.N8N_QUICK_CONNECT_OPTIONS = JSON.stringify(testConfig);
		Container.reset();
	});

	afterEach(() => {
		delete process.env.N8N_QUICK_CONNECT_OPTIONS;
	});

	test('should return configured quick connect options', async () => {
		const response = await authOwnerAgent.get('/quick-connect').expect(200);

		expect(response.body).toEqual(testConfig);
	});

	test('should return empty array when no options configured', async () => {
		process.env.N8N_QUICK_CONNECT_OPTIONS = '[]';

		const response = await authOwnerAgent.get('/quick-connect').expect(200);

		expect(response.body).toEqual([]);
	});
});
