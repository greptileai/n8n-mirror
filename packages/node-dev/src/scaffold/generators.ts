import * as changeCase from 'change-case';

import type { AuthType, ResourceConfig, ScaffoldConfig } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function pascal(s: string): string {
	return changeCase.pascalCase(s);
}

function camel(s: string): string {
	return changeCase.camelCase(s);
}

function capital(s: string): string {
	return changeCase.capitalCase(s);
}

function lower(s: string): string {
	return s.toLowerCase();
}

// ─── Credential File ────────────────────────────────────────────────────────

function credentialProperties(authType: AuthType): string {
	switch (authType) {
		case 'apiKeyHeader':
		case 'apiKeyQuery':
			return `[
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	]`;
		case 'bearerToken':
			return `[
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	]`;
		case 'basicAuth':
			return `[
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	]`;
		case 'oauth2':
			return `[
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: '', // TODO: Set authorization URL
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: '', // TODO: Set access token URL
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: '', // TODO: Set required scopes
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	]`;
		default:
			return '[]';
	}
}

function credentialAuthenticate(authType: AuthType): string {
	switch (authType) {
		case 'apiKeyHeader':
			return `authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}', // TODO: Update header name
			},
		},
	};`;
		case 'apiKeyQuery':
			return `authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				api_key: '={{$credentials.apiKey}}', // TODO: Update query parameter name
			},
		},
	};`;
		case 'bearerToken':
			return `authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};`;
		case 'basicAuth':
			return `authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
		},
	};`;
		case 'oauth2':
			return '// OAuth2 authentication is handled by the oAuth2Api base credential';
		default:
			return '';
	}
}

export function generateCredentialFile(config: ScaffoldConfig): string {
	const className = `${pascal(config.serviceName)}Api`;
	const credName = `${camel(config.serviceName)}Api`;
	const displayName = `${capital(config.serviceName)} API`;

	if (config.authType === 'none') {
		return '';
	}

	if (config.authType === 'oauth2') {
		return `import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ${className} implements ICredentialType {
	name = '${credName}';

	displayName = '${displayName}';

	// TODO: Update documentation URL
	documentationUrl = '${camel(config.serviceName)}';

	extends = ['oAuth2Api'];

	properties: INodeProperties[] = ${credentialProperties(config.authType)};
}
`;
	}

	return `import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ${className} implements ICredentialType {
	name = '${credName}';

	displayName = '${displayName}';

	// TODO: Update documentation URL
	documentationUrl = '${camel(config.serviceName)}';

	properties: INodeProperties[] = ${credentialProperties(config.authType)};

	${credentialAuthenticate(config.authType)}

	test: ICredentialTestRequest = {
		request: {
			baseURL: '${config.baseUrl}',
			url: '/me', // TODO: Update to actual test endpoint
		},
	};
}
`;
}

// ─── GenericFunctions File ──────────────────────────────────────────────────

export function generateGenericFunctions(config: ScaffoldConfig): string {
	const credName = `${camel(config.serviceName)}Api`;
	const fnName = `${camel(config.serviceName)}ApiRequest`;

	const authCall =
		config.authType === 'none'
			? 'return await this.helpers.request(options);'
			: `return await this.helpers.httpRequestWithAuthentication.call(this, '${credName}', options);`;

	let paginationFn = '';
	if (config.pagination) {
		paginationFn = `
export async function ${fnName}AllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
): Promise<IDataObject[]> {
	const returnData: IDataObject[] = [];
${generatePaginationBody(config, fnName)}
	return returnData;
}
`;
	}

	return `import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export async function ${fnName}(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method,
		url: \`${config.baseUrl}\${endpoint}\`,
		qs: query,
		json: true,
	};

	if (Object.keys(body).length) {
		options.body = body;
	}

	try {
		${authCall}
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
${paginationFn}`;
}

function generatePaginationBody(config: ScaffoldConfig, fnName: string): string {
	switch (config.paginationType) {
		case 'offset':
			return `	query.limit = 100;
	query.offset = 0;
	let responseData: IDataObject[];

	do {
		responseData = (await ${fnName}.call(this, method, endpoint, body, query)) as IDataObject[];
		returnData.push(...responseData);
		query.offset = (query.offset as number) + (query.limit as number);
	} while (responseData.length === query.limit);`;

		case 'cursor':
			return `	let cursor: string | undefined;

	do {
		if (cursor) {
			query.cursor = cursor;
		}
		const response = (await ${fnName}.call(this, method, endpoint, body, query)) as {
			data: IDataObject[];
			next_cursor?: string;
		};
		returnData.push(...response.data);
		cursor = response.next_cursor;
	} while (cursor);`;

		case 'pageNumber':
			return `	let page = 1;
	let responseData: IDataObject[];

	do {
		query.page = page;
		query.per_page = 100;
		responseData = (await ${fnName}.call(this, method, endpoint, body, query)) as IDataObject[];
		returnData.push(...responseData);
		page++;
	} while (responseData.length > 0);`;

		case 'linkHeader':
			return `	// TODO: Implement Link header pagination
	// Parse the Link header from the response to get the next page URL
	const responseData = (await ${fnName}.call(this, method, endpoint, body, query)) as IDataObject[];
	returnData.push(...responseData);`;

		default:
			return `	// TODO: Implement pagination logic
	const responseData = (await ${fnName}.call(this, method, endpoint, body, query)) as IDataObject[];
	returnData.push(...responseData);`;
	}
}

// ─── Resource Description File ──────────────────────────────────────────────

export function generateResourceDescription(
	resource: ResourceConfig,
	config: ScaffoldConfig,
): string {
	const resourceCamel = camel(resource.name);
	const resourceLower = lower(resource.name);

	const operationOptions = resource.operations
		.map((op) => {
			const opCamel = camel(op);
			const opDisplay = capital(op);
			const article = opDisplay === 'Get Many' ? '' : 'a ';

			if (config.nodeType === 'declarative') {
				return generateDeclarativeOperation(op, opCamel, opDisplay, resourceLower, article);
			}

			return `		{
				name: '${opDisplay}',
				value: '${opCamel}',
				description: '${opDisplay} ${article}${resourceLower}',
				action: '${opDisplay} ${article}${resourceLower}',
			},`;
		})
		.join('\n');

	return `import type { INodeProperties } from 'n8n-workflow';

export const ${resourceCamel}Operations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['${resourceCamel}'],
			},
		},
		options: [
${operationOptions}
		],
		default: '${camel(resource.operations[0])}',
	},
];

export const ${resourceCamel}Fields: INodeProperties[] = [
	// TODO: Add fields for each operation
	// Example field:
	// {
	// 	displayName: 'Name',
	// 	name: 'name',
	// 	type: 'string',
	// 	required: true,
	// 	displayOptions: {
	// 		show: {
	// 			resource: ['${resourceCamel}'],
	// 			operation: ['create'],
	// 		},
	// 	},
	// 	default: '',
	// 	description: 'The name of the ${resourceLower}',
	// },
];
`;
}

function generateDeclarativeOperation(
	_op: string,
	opCamel: string,
	opDisplay: string,
	resourceLower: string,
	article: string,
): string {
	const methodMap: Record<string, string> = {
		create: 'POST',
		get: 'GET',
		getMany: 'GET',
		getAll: 'GET',
		update: 'PUT',
		delete: 'DELETE',
	};

	const method = methodMap[opCamel] ?? 'GET';
	const urlSuffix =
		opCamel === 'get' || opCamel === 'update' || opCamel === 'delete'
			? `' + $parameter["${resourceLower}Id"]`
			: '';
	const urlExpr = urlSuffix
		? `url: '={{\"/${resourceLower}s/\" + $parameter["${resourceLower}Id"]}}'`
		: `url: '/${resourceLower}s'`;

	return `		{
				name: '${opDisplay}',
				value: '${opCamel}',
				description: '${opDisplay} ${article}${resourceLower}',
				action: '${opDisplay} ${article}${resourceLower}',
				routing: {
					request: {
						method: '${method}',
						${urlExpr},
					},
				},
			},`;
}

// ─── Main Node File (Regular/Programmatic) ──────────────────────────────────

export function generateNodeFile(config: ScaffoldConfig): string {
	const className = pascal(config.serviceName);
	const nodeName = camel(config.serviceName);
	const displayName = capital(config.serviceName);
	const fnName = `${camel(config.serviceName)}ApiRequest`;
	const credName = `${camel(config.serviceName)}Api`;

	const resourceImports = config.resources
		.map(
			(r) =>
				`import { ${camel(r.name)}Operations, ${camel(r.name)}Fields } from './${pascal(r.name)}Description';`,
		)
		.join('\n');

	const resourceOptions = config.resources
		.map(
			(r) =>
				`				{
						name: '${capital(r.name)}',
						value: '${camel(r.name)}',
					},`,
		)
		.join('\n');

	const resourceSpreads = config.resources
		.map((r) => `\t\t\t...${camel(r.name)}Operations,\n\t\t\t...${camel(r.name)}Fields,`)
		.join('\n');

	const credentialBlock =
		config.authType !== 'none'
			? `credentials: [
			{
				name: '${credName}',
				required: true,
			},
		],`
			: 'credentials: [],';

	// Build execute body with resource/operation routing
	const resourceCases = config.resources
		.map((r) => {
			const opCases = r.operations
				.map((op) => {
					const opCamel = camel(op);
					const method =
						opCamel === 'create'
							? 'POST'
							: opCamel === 'delete'
								? 'DELETE'
								: opCamel === 'update'
									? 'PUT'
									: 'GET';
					const endpoint = `/${lower(r.name)}s`;
					return `					if (operation === '${opCamel}') {
						// TODO: Implement ${op} logic
						responseData = await ${fnName}.call(this, '${method}', '${endpoint}');
					}`;
				})
				.join(' else ');

			return `				if (resource === '${camel(r.name)}') {
${opCases}
				}`;
		})
		.join(' else ');

	return `import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { ${fnName} } from './GenericFunctions';
${resourceImports}

export class ${className} implements INodeType {
	description: INodeTypeDescription = {
		displayName: '${displayName}',
		name: '${nodeName}',
		icon: 'file:${lower(config.serviceName)}.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{\$parameter["operation"] + ": " + \$parameter["resource"]}}',
		description: '${config.description}',
		defaults: {
			name: '${displayName}',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		${credentialBlock}
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
${resourceOptions}
				],
				default: '${camel(config.resources[0].name)}',
			},
${resourceSpreads}
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData;

${resourceCases}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData as IDataObject),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
`;
}

// ─── Declarative Node File ──────────────────────────────────────────────────

export function generateDeclarativeNodeFile(config: ScaffoldConfig): string {
	const className = pascal(config.serviceName);
	const nodeName = camel(config.serviceName);
	const displayName = capital(config.serviceName);
	const credName = `${camel(config.serviceName)}Api`;

	const resourceImports = config.resources
		.map(
			(r) =>
				`import { ${camel(r.name)}Operations, ${camel(r.name)}Fields } from './${pascal(r.name)}Description';`,
		)
		.join('\n');

	const resourceOptions = config.resources
		.map(
			(r) =>
				`				{
						name: '${capital(r.name)}',
						value: '${camel(r.name)}',
					},`,
		)
		.join('\n');

	const resourceSpreads = config.resources
		.map((r) => `\t\t\t...${camel(r.name)}Operations,\n\t\t\t...${camel(r.name)}Fields,`)
		.join('\n');

	const credentialBlock =
		config.authType !== 'none'
			? `credentials: [
			{
				name: '${credName}',
				required: true,
			},
		],`
			: 'credentials: [],';

	return `import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

${resourceImports}

export class ${className} implements INodeType {
	description: INodeTypeDescription = {
		displayName: '${displayName}',
		name: '${nodeName}',
		icon: 'file:${lower(config.serviceName)}.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{\$parameter["operation"] + ": " + \$parameter["resource"]}}',
		description: '${config.description}',
		defaults: {
			name: '${displayName}',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		${credentialBlock}
		requestDefaults: {
			baseURL: '${config.baseUrl}',
			headers: {},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
${resourceOptions}
				],
				default: '${camel(config.resources[0].name)}',
			},
${resourceSpreads}
		],
	};
}
`;
}

// ─── Webhook Trigger Node File ──────────────────────────────────────────────

export function generateWebhookTriggerFile(config: ScaffoldConfig): string {
	const className = `${pascal(config.serviceName)}Trigger`;
	const nodeName = `${camel(config.serviceName)}Trigger`;
	const displayName = `${capital(config.serviceName)} Trigger`;
	const fnName = `${camel(config.serviceName)}ApiRequest`;
	const credName = `${camel(config.serviceName)}Api`;

	const credentialBlock =
		config.authType !== 'none'
			? `credentials: [
			{
				name: '${credName}',
				required: true,
			},
		],`
			: 'credentials: [],';

	return `import type {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { ${fnName} } from './GenericFunctions';

export class ${className} implements INodeType {
	description: INodeTypeDescription = {
		displayName: '${displayName}',
		name: '${nodeName}',
		icon: 'file:${lower(config.serviceName)}.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{\$parameter["event"]}}',
		description: 'Starts the workflow when ${capital(config.serviceName)} events occur',
		defaults: {
			name: '${displayName}',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		${credentialBlock}
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				options: [
					// TODO: Add events from the API
					{
						name: 'Resource Created',
						value: 'resource.created',
					},
					{
						name: 'Resource Updated',
						value: 'resource.updated',
					},
					{
						name: 'Resource Deleted',
						value: 'resource.deleted',
					},
				],
				default: 'resource.created',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) {
					return false;
				}
				try {
					// TODO: Check if webhook exists at external service
					await ${fnName}.call(
						this,
						'GET',
						\`/webhooks/\${webhookData.webhookId}\`,
					);
				} catch (error) {
					return false;
				}
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const webhookData = this.getWorkflowStaticData('node');
				const event = this.getNodeParameter('event') as string;

				const body: IDataObject = {
					url: webhookUrl,
					events: [event],
				};

				// TODO: Adjust to match API webhook creation endpoint
				const response = await ${fnName}.call(
					this,
					'POST',
					'/webhooks',
					body,
				);
				webhookData.webhookId = (response as { id: string }).id;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId) {
					try {
						await ${fnName}.call(
							this,
							'DELETE',
							\`/webhooks/\${webhookData.webhookId}\`,
						);
					} catch (error) {
						return false;
					}
				}
				delete webhookData.webhookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		return {
			workflowData: [this.helpers.returnJsonArray(req.body as IDataObject[])],
		};
	}
}
`;
}

// ─── Polling Trigger Node File ──────────────────────────────────────────────

export function generatePollingTriggerFile(config: ScaffoldConfig): string {
	const className = `${pascal(config.serviceName)}Trigger`;
	const nodeName = `${camel(config.serviceName)}Trigger`;
	const displayName = `${capital(config.serviceName)} Trigger`;
	const fnName = `${camel(config.serviceName)}ApiRequest`;
	const credName = `${camel(config.serviceName)}Api`;

	const credentialBlock =
		config.authType !== 'none'
			? `credentials: [
			{
				name: '${credName}',
				required: true,
			},
		],`
			: 'credentials: [],';

	return `import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { ${fnName} } from './GenericFunctions';

export class ${className} implements INodeType {
	description: INodeTypeDescription = {
		displayName: '${displayName}',
		name: '${nodeName}',
		icon: 'file:${lower(config.serviceName)}.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when ${capital(config.serviceName)} events occur',
		defaults: {
			name: '${displayName}',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		${credentialBlock}
		polling: true,
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				options: [
					// TODO: Add events
					{
						name: 'New Item',
						value: 'newItem',
					},
				],
				default: 'newItem',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const webhookData = this.getWorkflowStaticData('node');
		const event = this.getNodeParameter('event') as string;

		// TODO: Implement polling logic
		// 1. Fetch new items since last poll
		// 2. Store state for next poll (e.g., last item ID or timestamp)
		const lastTimestamp = webhookData.lastTimestamp as string | undefined;

		const query: IDataObject = {};
		if (lastTimestamp) {
			query.since = lastTimestamp;
		}

		const responseData = (await ${fnName}.call(
			this,
			'GET',
			'/events', // TODO: Update endpoint
			{},
			query,
		)) as IDataObject[];

		if (!responseData.length) {
			return null;
		}

		// Store the timestamp for next poll
		webhookData.lastTimestamp = new Date().toISOString();

		return [this.helpers.returnJsonArray(responseData)];
	}
}
`;
}

// ─── Test File ──────────────────────────────────────────────────────────────

export function generateTestFile(config: ScaffoldConfig): string {
	const className = pascal(config.serviceName);
	const credName = `${camel(config.serviceName)}Api`;

	let credBlock = '';
	if (config.authType !== 'none') {
		let credFields: string;
		switch (config.authType) {
			case 'bearerToken':
				credFields = "accessToken: 'test-token',";
				break;
			case 'basicAuth':
				credFields = "username: 'testuser',\n\t\t\tpassword: 'testpass',";
				break;
			case 'oauth2':
				credFields = "oauthTokenData: { access_token: 'test-token' },";
				break;
			default:
				credFields = "apiKey: 'test-api-key',";
		}
		credBlock = `

const credentials = {
	${credName}: {
		${credFields}
	},
};`;
	}

	const credArg = config.authType !== 'none' ? '{ credentials }' : '';

	return `import { NodeTestHarness } from '@nodes-testing/node-test-harness';
${credBlock}

describe('${className} Node', () => {
	new NodeTestHarness().setupTests(${credArg});
});
`;
}

// ─── Node JSON Metadata ────────────────────────────────────────────────────

export function generateNodeJson(config: ScaffoldConfig): string {
	const nodeName = camel(config.serviceName);

	const obj = {
		node: `n8n-nodes-base.${nodeName}`,
		nodeVersion: '1.0',
		codexVersion: '1.0',
		categories: ['Miscellaneous'],
		resources: {
			credentialDocumentation: [
				{
					url: `https://docs.n8n.io/integrations/builtin/credentials/${nodeName}/`,
				},
			],
			primaryDocumentation: [
				{
					url: `https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.${nodeName}/`,
				},
			],
		},
		alias: [],
	};

	return JSON.stringify(obj, null, '\t') + '\n';
}

// ─── Placeholder SVG ────────────────────────────────────────────────────────

export function generatePlaceholderSvg(serviceName: string): string {
	const initials = serviceName
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.split(' ')
		.map((w) => w[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" fill="none">
	<rect width="60" height="60" rx="12" fill="#7C3AED"/>
	<text x="30" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white">${initials}</text>
</svg>
`;
}
