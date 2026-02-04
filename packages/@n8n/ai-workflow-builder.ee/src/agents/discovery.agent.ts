/**
 * Discovery Agent using LangChain v1 createAgent API
 *
 * Identifies n8n nodes and connection-changing parameters for workflow building.
 * Uses responseFormat for structured output instead of a submit tool.
 */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage } from '@langchain/core/messages';
import type { Logger } from '@n8n/backend-common';
import { createAgent } from 'langchain';
import type { INodeTypeDescription } from 'n8n-workflow';
import { z } from 'zod';

import { buildDiscoveryPrompt } from '@/prompts';
import { createGetDocumentationTool } from '@/tools/get-documentation.tool';
import { createGetWorkflowExamplesTool } from '@/tools/get-workflow-examples.tool';
import { createNodeSearchTool } from '@/tools/node-search.tool';
import type { BuilderFeatureFlags } from '@/workflow-builder-agent';

/**
 * Strict Output Schema for Discovery
 * Simplified to reduce token usage while maintaining utility for downstream subgraphs.
 * This replaces the submit_discovery_results tool pattern with responseFormat.
 */
export const discoveryOutputSchema = z.object({
	nodesFound: z
		.array(
			z.object({
				nodeName: z.string().describe('The internal name of the node (e.g., n8n-nodes-base.gmail)'),
				version: z
					.number()
					.describe('The version number of the node (e.g., 1, 1.1, 2, 3, 3.2, etc.)'),
				reasoning: z.string().describe('Why this node is relevant for the workflow'),
				connectionChangingParameters: z
					.array(
						z.object({
							name: z
								.string()
								.describe('Parameter name (e.g., "mode", "operation", "hasOutputParser")'),
							possibleValues: z
								.array(z.union([z.string(), z.boolean(), z.number()]))
								.describe('Possible values this parameter can take'),
						}),
					)
					.describe(
						'Parameters that affect node connections (inputs/outputs). ONLY include if parameter appears in <input> or <output> expressions',
					),
			}),
		)
		.describe('List of n8n nodes identified as necessary for the workflow'),
});

/**
 * Type inferred from the discovery output schema
 */
export type DiscoveryOutput = z.infer<typeof discoveryOutputSchema>;

/**
 * Configuration for creating the Discovery agent
 */
export interface DiscoveryAgentConfig {
	llm: BaseChatModel;
	parsedNodeTypes: INodeTypeDescription[];
	featureFlags?: BuilderFeatureFlags;
	logger?: Logger;
}

/**
 * Create Discovery agent using LangChain v1 createAgent.
 *
 * The Discovery agent identifies relevant n8n nodes and their connection-changing
 * parameters for the user's workflow request. It uses responseFormat for structured
 * output instead of the old submit_discovery_results tool pattern.
 */
export function createDiscoveryAgent(config: DiscoveryAgentConfig) {
	const includeExamples = config.featureFlags?.templateExamples === true;

	// Build tools array - search_nodes is always included
	const tools = [
		createNodeSearchTool(config.parsedNodeTypes).tool,
		...(includeExamples
			? [createGetDocumentationTool().tool, createGetWorkflowExamplesTool(config.logger).tool]
			: []),
	];

	// Generate prompt based on feature flags
	const discoveryPromptText = buildDiscoveryPrompt({ includeExamples });

	// Use SystemMessage with cache_control for Anthropic prompt caching
	const systemPrompt = new SystemMessage({
		content: [
			{
				type: 'text',
				text: discoveryPromptText,
				cache_control: { type: 'ephemeral' },
			},
		],
	});

	return createAgent({
		model: config.llm,
		tools,
		systemPrompt,
		// responseFormat enables structured output - replaces submit_discovery_results tool
		responseFormat: discoveryOutputSchema,
	});
}

/**
 * Type for the compiled agent returned by createDiscoveryAgent
 */
export type DiscoveryAgentType = ReturnType<typeof createDiscoveryAgent>;
