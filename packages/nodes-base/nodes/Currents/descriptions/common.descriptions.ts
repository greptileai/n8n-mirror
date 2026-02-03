import type { INodeProperties } from 'n8n-workflow';

export const projectRLC: INodeProperties = {
	displayName: 'Project',
	name: 'projectId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The Currents project',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a project...',
			typeOptions: {
				searchListMethod: 'getProjects',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. abc123',
		},
	],
};

export const filterAuthorsOption: INodeProperties = {
	displayName: 'Git Authors',
	name: 'authors',
	type: 'string',
	default: '',
	routing: {
		send: {
			type: 'query',
			property: 'authors[]',
		},
	},
	description: 'Filter by git authors (multiple values supported)',
};

export const filterBranchesOption: INodeProperties = {
	displayName: 'Branches',
	name: 'branches',
	type: 'string',
	default: '',
	routing: {
		send: {
			type: 'query',
			property: 'branches[]',
		},
	},
	description: 'Filter by branches (multiple values supported)',
};

export const filterGroupsOption: INodeProperties = {
	displayName: 'Groups',
	name: 'groups',
	type: 'string',
	default: '',
	routing: {
		send: {
			type: 'query',
			property: 'groups[]',
		},
	},
	description: 'Filter by groups (multiple values supported)',
};

export const filterTagsOption: INodeProperties = {
	displayName: 'Tags',
	name: 'tags',
	type: 'string',
	default: '',
	routing: {
		send: {
			type: 'query',
			property: 'tags[]',
		},
	},
	description: 'Filter by tags (multiple values supported)',
};
