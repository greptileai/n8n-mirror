/**
 * Discovery Wrapper for Parent Graph Integration
 *
 * This wrapper handles the transformInput/transformOutput pattern for the
 * Discovery agent, allowing it to be used as a node in the parent graph.
 * It replaces the old DiscoverySubgraph class.
 */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { Logger } from '@n8n/backend-common';
import type { INodeTypeDescription } from 'n8n-workflow';

import {
	createDiscoveryAgent,
	type DiscoveryAgentType,
	type DiscoveryOutput,
} from '@/agents/discovery.agent';
import type { ParentGraphState } from '@/parent-graph-state';
import type { CoordinationLogEntry } from '@/types/coordination';
import { createDiscoveryMetadata } from '@/types/coordination';
import type { WorkflowMetadata } from '@/types/tools';
import { buildWorkflowSummary, createContextMessage } from '@/utils/context-builders';
import {
	extractResourceOperations,
	createResourceCacheKey,
	type ResourceOperationInfo,
} from '@/utils/resource-operation-extractor';
import { extractUserRequest } from '@/utils/subgraph-helpers';
import type { BuilderFeatureFlags } from '@/workflow-builder-agent';

/**
 * Configuration for the Discovery wrapper
 */
export interface DiscoveryWrapperConfig {
	llm: BaseChatModel;
	parsedNodeTypes: INodeTypeDescription[];
	logger?: Logger;
	featureFlags?: BuilderFeatureFlags;
}

/**
 * Input transformed from parent state for the Discovery agent
 */
interface DiscoveryInput {
	userRequest: string;
	contextMessage: ReturnType<typeof createContextMessage>;
}

/**
 * Output from the Discovery wrapper to update parent state
 */
interface DiscoveryWrapperOutput {
	discoveryContext: {
		nodesFound: Array<{
			nodeName: string;
			version: number;
			reasoning: string;
			connectionChangingParameters: Array<{
				name: string;
				possibleValues: Array<string | boolean | number>;
			}>;
			availableResources?: Array<{
				value: string;
				displayName: string;
				operations: Array<{
					value: string;
					displayName: string;
				}>;
			}>;
		}>;
		bestPractices?: string;
	};
	coordinationLog: CoordinationLogEntry[];
	templateIds: number[];
	cachedTemplates: WorkflowMetadata[];
}

/**
 * Creates a Discovery wrapper that integrates the createAgent-based Discovery
 * agent with the parent graph.
 *
 * The wrapper provides:
 * - transformInput: Converts parent state to agent input
 * - invoke: Runs the Discovery agent
 * - transformOutput: Converts agent output to parent state updates
 */
export function createDiscoveryWrapper(config: DiscoveryWrapperConfig) {
	const agent: DiscoveryAgentType = createDiscoveryAgent({
		llm: config.llm,
		parsedNodeTypes: config.parsedNodeTypes,
		featureFlags: config.featureFlags,
		logger: config.logger,
	});

	// Build node type lookup map for resource hydration
	const nodeTypeMap = new Map<string, INodeTypeDescription>();
	for (const nt of config.parsedNodeTypes) {
		const versions = Array.isArray(nt.version) ? nt.version : [nt.version];
		for (const v of versions) {
			nodeTypeMap.set(`${nt.name}:${v}`, nt);
		}
	}

	// Cache for resource operation info
	const resourceOperationCache = new Map<string, ResourceOperationInfo | null>();

	return {
		name: 'discovery',

		/**
		 * Transform parent state to agent input
		 */
		transformInput(parentState: typeof ParentGraphState.State): DiscoveryInput {
			const userRequest = extractUserRequest(parentState.messages, 'Build a workflow');

			// Build context parts for Discovery
			const contextParts: string[] = [];

			// 1. User request (primary)
			contextParts.push('<user_request>');
			contextParts.push(userRequest);
			contextParts.push('</user_request>');

			// 2. Current workflow summary (just node names, to know what exists)
			// Discovery doesn't need full JSON, just awareness of existing nodes
			if (parentState.workflowJSON.nodes.length > 0) {
				contextParts.push('<existing_workflow_summary>');
				contextParts.push(buildWorkflowSummary(parentState.workflowJSON));
				contextParts.push('</existing_workflow_summary>');
			}

			// Create initial message with context
			const contextMessage = createContextMessage(contextParts);

			return {
				userRequest,
				contextMessage,
			};
		},

		/**
		 * Invoke the Discovery agent
		 */
		async invoke(input: DiscoveryInput, runnableConfig?: RunnableConfig): Promise<DiscoveryOutput> {
			const result = await agent.invoke(
				{
					messages: [input.contextMessage],
				},
				runnableConfig,
			);

			// The structuredResponse field contains the parsed output from responseFormat
			return result.structuredResponse as DiscoveryOutput;
		},

		/**
		 * Transform agent output to parent state updates
		 * Includes resource hydration for discovered nodes
		 */
		transformOutput(
			output: DiscoveryOutput,
			_parentState: typeof ParentGraphState.State,
		): DiscoveryWrapperOutput {
			// Hydrate nodesFound with availableResources from node type definitions
			const hydratedNodesFound = output.nodesFound.map((node) => {
				const cacheKey = createResourceCacheKey(node.nodeName, node.version);

				// Check cache first
				if (resourceOperationCache.has(cacheKey)) {
					const cached = resourceOperationCache.get(cacheKey);
					if (cached) {
						return {
							...node,
							availableResources: cached.resources,
						};
					}
					// Cached as null means no resources for this node
					return node;
				}

				// Cache miss - extract fresh
				const nodeType = nodeTypeMap.get(cacheKey);

				if (!nodeType) {
					config.logger?.warn('[Discovery] Node type not found during resource hydration', {
						nodeName: node.nodeName,
						nodeVersion: node.version,
					});
					resourceOperationCache.set(cacheKey, null);
					return node;
				}

				// Extract resource/operation info
				const resourceOpInfo = extractResourceOperations(nodeType, node.version, config.logger);

				// Cache the result
				resourceOperationCache.set(cacheKey, resourceOpInfo);

				if (!resourceOpInfo) {
					return node;
				}

				// Add availableResources to the node
				return {
					...node,
					availableResources: resourceOpInfo.resources,
				};
			});

			const discoveryContext = {
				nodesFound: hydratedNodesFound,
				bestPractices: undefined, // Set by get_documentation tool if used
			};

			const logEntry: CoordinationLogEntry = {
				phase: 'discovery',
				status: 'completed',
				timestamp: Date.now(),
				summary: `Discovered ${hydratedNodesFound.length} nodes`,
				metadata: createDiscoveryMetadata({
					nodesFound: hydratedNodesFound.length,
					nodeTypes: hydratedNodesFound.map((n) => n.nodeName),
					hasBestPractices: false,
				}),
			};

			return {
				discoveryContext,
				coordinationLog: [logEntry],
				templateIds: [],
				cachedTemplates: [],
			};
		},
	};
}

/**
 * Type for the wrapper returned by createDiscoveryWrapper
 */
export type DiscoveryWrapperType = ReturnType<typeof createDiscoveryWrapper>;
