import { Command } from '@oclif/core';
import * as changeCase from 'change-case';
import { mkdir, writeFile } from 'fs/promises';
import * as inquirer from 'inquirer';
import * as path from 'path';

import {
	generateCredentialFile,
	generateDeclarativeNodeFile,
	generateGenericFunctions,
	generateNodeFile,
	generateNodeJson,
	generatePlaceholderSvg,
	generatePollingTriggerFile,
	generateResourceDescription,
	generateTestFile,
	generateWebhookTriggerFile,
	updatePackageJson,
} from '../src/scaffold';
import type {
	AuthType,
	NodeType,
	PaginationType,
	ResourceConfig,
	ScaffoldConfig,
} from '../src/scaffold';

export class Scaffold extends Command {
	static description = 'Scaffold a complete n8n node with all required files';

	static examples = ['$ n8n-node-dev scaffold'];

	async run(): Promise<void> {
		try {
			this.log('\nScaffold a new n8n node');
			this.log('======================\n');

			const config = await this.collectInput();
			const files = await this.generateFiles(config);

			this.log('\nFiles created:');
			for (const f of files) {
				this.log(`  ✓ ${f}`);
			}

			this.log('\nNext steps:');
			this.log('  1. Fill in TODO sections in generated files');
			this.log('  2. Replace the placeholder SVG icon');
			this.log('  3. Run: pnpm build');
			this.log('  4. Test your node in the n8n UI');
		} catch (error) {
			this.log(`\nError: "${(error as Error).message}"`);
			this.log((error as Error).stack ?? '');
		}
	}

	private async collectInput(): Promise<ScaffoldConfig> {
		// Basic info
		const basicAnswers = await inquirer.prompt([
			{
				type: 'list',
				name: 'nodeType',
				message: 'What type of node?',
				choices: [
					{ name: 'Regular (HTTP API with execute)', value: 'regular' },
					{ name: 'Declarative (routing-based, no execute)', value: 'declarative' },
					{ name: 'Trigger (Webhook)', value: 'webhookTrigger' },
					{ name: 'Trigger (Polling)', value: 'pollingTrigger' },
				],
			},
			{
				name: 'serviceName',
				type: 'input',
				message: 'Service name (PascalCase, e.g. "Stripe", "HubSpot"):',
				validate: (v: string) =>
					/^[A-Z][a-zA-Z0-9]+$/.test(v) || 'Must be PascalCase (e.g. Stripe, HubSpot)',
			},
			{
				name: 'description',
				type: 'input',
				message: 'Short description:',
				default: (answers: { serviceName: string }) =>
					`Interact with the ${changeCase.capitalCase(answers.serviceName)} API`,
			},
			{
				name: 'baseUrl',
				type: 'input',
				message: 'API base URL (e.g. https://api.stripe.com/v1):',
				validate: (v: string) =>
					v.startsWith('http') || 'Must be a valid URL starting with http(s)://',
			},
			{
				type: 'list',
				name: 'authType',
				message: 'Authentication type?',
				choices: [
					{ name: 'API Key (Header)', value: 'apiKeyHeader' },
					{ name: 'API Key (Query Param)', value: 'apiKeyQuery' },
					{ name: 'Bearer Token', value: 'bearerToken' },
					{ name: 'OAuth2', value: 'oauth2' },
					{ name: 'Basic Auth', value: 'basicAuth' },
					{ name: 'None', value: 'none' },
				],
			},
		]);

		// Resources
		const resources: ResourceConfig[] = [];
		let addMore = true;

		while (addMore) {
			const resourceAnswer = await inquirer.prompt([
				{
					name: 'name',
					type: 'input',
					message: `Resource name (PascalCase, e.g. "User", "Message"):`,
					validate: (v: string) => /^[A-Z][a-zA-Z0-9]+$/.test(v) || 'Must be PascalCase',
				},
				{
					name: 'operations',
					type: 'checkbox',
					message: 'Operations:',
					choices: ['Create', 'Get', 'Get Many', 'Update', 'Delete'],
					default: ['Create', 'Get', 'Get Many', 'Update', 'Delete'],
					validate: (v: string[]) => v.length > 0 || 'Select at least one operation',
				},
			]);

			resources.push({
				name: resourceAnswer.name as string,
				operations: resourceAnswer.operations as string[],
			});

			const continueAnswer = await inquirer.prompt([
				{
					name: 'more',
					type: 'confirm',
					message: 'Add another resource?',
					default: false,
				},
			]);

			addMore = continueAnswer.more as boolean;
		}

		// Pagination
		let pagination = false;
		let paginationType: PaginationType | undefined;

		const paginationAnswer = await inquirer.prompt([
			{
				name: 'pagination',
				type: 'confirm',
				message: 'Does the API support pagination?',
				default: true,
			},
		]);

		pagination = paginationAnswer.pagination as boolean;

		if (pagination) {
			const paginationTypeAnswer = await inquirer.prompt([
				{
					type: 'list',
					name: 'paginationType',
					message: 'Pagination type?',
					choices: [
						{ name: 'Offset (limit/offset)', value: 'offset' },
						{ name: 'Cursor-based', value: 'cursor' },
						{ name: 'Page Number', value: 'pageNumber' },
						{ name: 'Link Header', value: 'linkHeader' },
					],
				},
			]);
			paginationType = paginationTypeAnswer.paginationType as PaginationType;
		}

		return {
			serviceName: basicAnswers.serviceName as string,
			description: basicAnswers.description as string,
			baseUrl: basicAnswers.baseUrl as string,
			nodeType: basicAnswers.nodeType as NodeType,
			authType: basicAnswers.authType as AuthType,
			resources,
			pagination,
			paginationType,
		};
	}

	private async generateFiles(config: ScaffoldConfig): Promise<string[]> {
		const createdFiles: string[] = [];

		// Resolve paths relative to the monorepo
		const nodesBaseDir = path.resolve(__dirname, '../../nodes-base');
		const nodeDir = path.join(nodesBaseDir, 'nodes', config.serviceName);
		const testDir = path.join(nodeDir, '__tests__');
		const schemaDir = path.join(nodeDir, '__schema__');
		const credDir = path.join(nodesBaseDir, 'credentials');

		// Create directories
		await mkdir(nodeDir, { recursive: true });
		await mkdir(testDir, { recursive: true });
		await mkdir(schemaDir, { recursive: true });

		// Generate main node file based on type
		let nodeContent: string;
		let nodeFileName: string;

		switch (config.nodeType) {
			case 'declarative':
				nodeContent = generateDeclarativeNodeFile(config);
				nodeFileName = `${config.serviceName}.node.ts`;
				break;
			case 'webhookTrigger':
				nodeContent = generateWebhookTriggerFile(config);
				nodeFileName = `${config.serviceName}Trigger.node.ts`;
				break;
			case 'pollingTrigger':
				nodeContent = generatePollingTriggerFile(config);
				nodeFileName = `${config.serviceName}Trigger.node.ts`;
				break;
			default:
				nodeContent = generateNodeFile(config);
				nodeFileName = `${config.serviceName}.node.ts`;
				break;
		}

		await writeFile(path.join(nodeDir, nodeFileName), nodeContent);
		createdFiles.push(path.join(nodeDir, nodeFileName));

		// GenericFunctions (always generated for API helpers)
		const genericContent = generateGenericFunctions(config);
		await writeFile(path.join(nodeDir, 'GenericFunctions.ts'), genericContent);
		createdFiles.push(path.join(nodeDir, 'GenericFunctions.ts'));

		// Resource description files
		for (const resource of config.resources) {
			const descContent = generateResourceDescription(resource, config);
			const descFileName = `${resource.name}Description.ts`;
			await writeFile(path.join(nodeDir, descFileName), descContent);
			createdFiles.push(path.join(nodeDir, descFileName));
		}

		// Credential file
		if (config.authType !== 'none') {
			const credContent = generateCredentialFile(config);
			const credFileName = `${config.serviceName}Api.credentials.ts`;
			await writeFile(path.join(credDir, credFileName), credContent);
			createdFiles.push(path.join(credDir, credFileName));
		}

		// Test file
		const testContent = generateTestFile(config);
		const testFileName = `${config.serviceName}.test.ts`;
		await writeFile(path.join(testDir, testFileName), testContent);
		createdFiles.push(path.join(testDir, testFileName));

		// Node JSON metadata
		const jsonContent = generateNodeJson(config);
		const jsonFileName = `${config.serviceName}.node.json`;
		await writeFile(path.join(nodeDir, jsonFileName), jsonContent);
		createdFiles.push(path.join(nodeDir, jsonFileName));

		// Placeholder SVG icon
		const svgContent = generatePlaceholderSvg(config.serviceName);
		const svgFileName = `${config.serviceName.toLowerCase()}.svg`;
		await writeFile(path.join(nodeDir, svgFileName), svgContent);
		createdFiles.push(path.join(nodeDir, svgFileName));

		// Update package.json registration
		const nodeDistPath =
			config.nodeType === 'webhookTrigger' || config.nodeType === 'pollingTrigger'
				? `dist/nodes/${config.serviceName}/${config.serviceName}Trigger.node.js`
				: `dist/nodes/${config.serviceName}/${config.serviceName}.node.js`;

		const nodeDistPaths = [nodeDistPath];
		const credDistPaths =
			config.authType !== 'none'
				? [`dist/credentials/${config.serviceName}Api.credentials.js`]
				: [];

		await updatePackageJson(nodesBaseDir, nodeDistPaths, credDistPaths);
		createdFiles.push(`${nodesBaseDir}/package.json (updated)`);

		return createdFiles;
	}
}
