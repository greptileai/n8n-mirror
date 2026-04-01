export type NodeType = 'regular' | 'webhookTrigger' | 'pollingTrigger' | 'declarative';

export type AuthType =
	| 'apiKeyHeader'
	| 'apiKeyQuery'
	| 'bearerToken'
	| 'oauth2'
	| 'basicAuth'
	| 'none';

export type PaginationType = 'offset' | 'cursor' | 'pageNumber' | 'linkHeader';

export interface ResourceConfig {
	name: string;
	operations: string[];
}

export interface ScaffoldConfig {
	serviceName: string;
	description: string;
	baseUrl: string;
	nodeType: NodeType;
	authType: AuthType;
	resources: ResourceConfig[];
	pagination: boolean;
	paginationType?: PaginationType;
}
