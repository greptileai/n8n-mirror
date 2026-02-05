import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class N8nInternalBinaryDataServiceApi implements ICredentialType {
	name = 'n8nInternalBinaryDataServiceApi';

	// eslint-disable-next-line n8n-nodes-base/cred-class-field-display-name-miscased
	displayName = 'n8n Internal Binary Data Service API';

	documentationUrl = 'https://docs.n8n.io/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'The API key for the n8n internal binary data service',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://binary-data.internal.n8n.io',
			description: 'The base URL of the internal binary data service',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-N8N-API-KEY': '={{ $credentials.apiKey }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/health',
		},
	};
}
