import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class N8nInternalBinaryDataServiceApi implements ICredentialType {
	name = 'n8nInternalBinaryDataServiceApi';

	// eslint-disable-next-line n8n-nodes-base/cred-class-field-display-name-miscased
	displayName = 'n8n Internal Binary Data Service API';

	documentationUrl = 'https://docs.n8n.io/';

	properties: INodeProperties[] = [
		{
			displayName: 'Storage Mode',
			name: 'mode',
			type: 'options',
			options: [
				{
					name: 'Filesystem',
					value: 'filesystem',
				},
				{
					name: 'S3',
					value: 's3',
				},
			],
			default: 'filesystem',
			description: 'The storage backend mode',
		},
		{
			displayName: 'Bucket',
			name: 'bucket',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					mode: ['s3'],
				},
			},
			description: 'The S3 bucket name',
		},
		{
			displayName: 'Region',
			name: 'region',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					mode: ['s3'],
				},
			},
			description: 'The AWS region',
		},
		{
			displayName: 'Access Key ID',
			name: 'accessKeyId',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					mode: ['s3'],
				},
			},
			description: 'The AWS access key ID',
		},
		{
			displayName: 'Secret Access Key',
			name: 'secretAccessKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: {
				show: {
					mode: ['s3'],
				},
			},
			description: 'The AWS secret access key',
		},
		{
			displayName: 'Endpoint',
			name: 'endpoint',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					mode: ['s3'],
				},
			},
			description: 'Optional custom S3 endpoint URL',
		},
		{
			displayName: 'Storage Path',
			name: 'storagePath',
			type: 'string',
			default: '',
			description: 'The storage path for binary data',
		},
	];
}
