import { expect, test } from '../../../../fixtures/base';

test.use({ capability: 'external-secrets' });

test.setTimeout(180_000); // LocalStack can take time to start up

const PROVIDER_KEY = 'aws-localstack-e2e';
const PROVIDER_TYPE = 'awsSecretsManager';

test.describe('Secret Providers Connections @licensed', () => {
	test.beforeEach(async ({ n8n, n8nContainer }) => {
		await n8n.api.enableFeature('externalSecrets');
		await n8nContainer.services.localstack.secretsManager.clear();
	});

	test.afterEach(async ({ n8n }) => {
		try {
			await n8n.api.request.delete(`/rest/secret-providers/connections/${PROVIDER_KEY}`);
		} catch {
			// Connection may not exist
		}
	});

	test('should create AWS Secrets Manager connection via LocalStack', async ({
		n8n,
		n8nContainer,
	}) => {
		const { secretsManager } = n8nContainer.services.localstack;

		// Seed secrets in LocalStack
		await secretsManager.createSecret('e2e-api-key', 'secret-123');
		await secretsManager.createSecret(
			'e2e-db-credentials',
			JSON.stringify({ username: 'admin', password: 'hunter2' }),
		);

		const secrets = await secretsManager.listSecrets();
		expect(secrets).toContain('e2e-api-key');
		expect(secrets).toContain('e2e-db-credentials');

		// Create connection (n8n container has AWS_ENDPOINT_URL pointing to LocalStack)
		const createResponse = await n8n.api.request.post('/rest/secret-providers/connections', {
			data: {
				providerKey: PROVIDER_KEY,
				type: PROVIDER_TYPE,
				projectIds: [],
				settings: {
					region: 'us-east-1',
					authMethod: 'iamUser',
					accessKeyId: 'test',
					secretAccessKey: 'test',
				},
			},
		});

		expect(createResponse.ok()).toBeTruthy();
		const created = await createResponse.json();
		expect(created.data.name).toBe(PROVIDER_KEY);
		expect(created.data.type).toBe(PROVIDER_TYPE);

		// TODO: Verify secrets are loaded once that functionality is implemented
	});
});
