/**
 * Plugin Architecture Types
 *
 * Defines interfaces for the plugin system that allows extending
 * WorkflowBuilder with custom validators, composite handlers, and serializers.
 */

import type { GraphNode, NodeInstance, IDataObject } from '../types/base';

// =============================================================================
// Validation Issue
// =============================================================================

/**
 * A validation issue (error or warning) reported by a validator plugin.
 */
export interface ValidationIssue {
	/** Unique code identifying the issue type */
	readonly code: string;
	/** Human-readable message describing the issue */
	readonly message: string;
	/** Severity level: 'error' for fatal issues, 'warning' for non-fatal */
	readonly severity: 'error' | 'warning';
	/** Name of the node where the issue was found (optional) */
	readonly nodeName?: string;
	/** Path to the parameter that caused the issue (optional) */
	readonly parameterPath?: string;
}

// =============================================================================
// Plugin Context
// =============================================================================

/**
 * Read-only context passed to plugins for accessing workflow state.
 */
export interface PluginContext {
	/** Map of node names to their graph representations */
	readonly nodes: ReadonlyMap<string, GraphNode>;
	/** Workflow ID */
	readonly workflowId: string;
	/** Workflow name */
	readonly workflowName: string;
	/** Workflow settings */
	readonly settings: Record<string, unknown>;
	/** Optional pin data for nodes */
	readonly pinData?: Record<string, IDataObject[]>;
}

/**
 * Mutable context passed to plugins that need to modify workflow state.
 * Used by composite handlers when adding nodes to the graph.
 */
export interface MutablePluginContext extends Omit<PluginContext, 'nodes'> {
	/** Mutable map of node names to their graph representations */
	nodes: Map<string, GraphNode>;

	/**
	 * Add a node and its subnodes to the graph.
	 * @param node The node instance to add
	 * @returns The node ID if assigned, or undefined
	 */
	addNodeWithSubnodes(node: NodeInstance<string, string, unknown>): string | undefined;

	/**
	 * Add a branch (chain of nodes) to the graph.
	 * @param branch The branch to add (NodeInstance, NodeChain, or array)
	 * @returns The name of the head node of the branch
	 */
	addBranchToGraph(branch: unknown): string;
}

// =============================================================================
// Validator Plugin
// =============================================================================

/**
 * A plugin that validates nodes and/or workflows.
 *
 * Validators can target specific node types or all nodes. They're executed
 * during workflow validation and can return errors (fatal) or warnings.
 *
 * @example
 * ```typescript
 * const agentValidator: ValidatorPlugin = {
 *   id: 'core:agent',
 *   name: 'Agent Validator',
 *   nodeTypes: ['@n8n/n8n-nodes-langchain.agent'],
 *   validateNode: (node, graphNode, ctx) => {
 *     const issues: ValidationIssue[] = [];
 *     if (node.config?.parameters?.promptType === 'define') {
 *       // Check for static prompt
 *       issues.push({
 *         code: 'AGENT_STATIC_PROMPT',
 *         message: 'Agent using static prompt',
 *         severity: 'warning',
 *         nodeName: node.name,
 *       });
 *     }
 *     return issues;
 *   },
 * };
 * ```
 */
export interface ValidatorPlugin {
	/** Unique identifier for this validator (e.g., 'core:agent') */
	readonly id: string;
	/** Human-readable name for this validator */
	readonly name: string;
	/**
	 * Node types this validator applies to.
	 * Empty array or undefined means applies to all nodes.
	 */
	readonly nodeTypes?: string[];
	/**
	 * Priority for execution order (higher runs first).
	 * Default is 0.
	 */
	readonly priority?: number;

	/**
	 * Validate a single node.
	 * @param node The node instance being validated
	 * @param graphNode The graph representation of the node
	 * @param ctx Plugin context with workflow state
	 * @returns Array of validation issues found
	 */
	validateNode(
		node: NodeInstance<string, string, unknown>,
		graphNode: GraphNode,
		ctx: PluginContext,
	): ValidationIssue[];

	/**
	 * Validate the entire workflow (optional).
	 * Called once per validation, after all nodes have been validated.
	 * @param ctx Plugin context with workflow state
	 * @returns Array of validation issues found
	 */
	validateWorkflow?(ctx: PluginContext): ValidationIssue[];
}

// =============================================================================
// Composite Handler Plugin
// =============================================================================

/**
 * A plugin that handles composite node structures (if/else, switch/case, etc.).
 *
 * Composite handlers are responsible for recognizing composite patterns and
 * adding the appropriate nodes and connections to the workflow graph.
 *
 * @example
 * ```typescript
 * const ifElseHandler: CompositeHandlerPlugin<IfElseComposite> = {
 *   id: 'core:if-else',
 *   name: 'If/Else Handler',
 *   canHandle: (input): input is IfElseComposite =>
 *     isIfElseComposite(input),
 *   addNodes: (composite, ctx) => {
 *     ctx.addNodeWithSubnodes(composite.ifNode);
 *     if (composite.trueBranch) {
 *       ctx.addBranchToGraph(composite.trueBranch);
 *     }
 *     return composite.ifNode.name;
 *   },
 * };
 * ```
 */
export interface CompositeHandlerPlugin<TInput = unknown> {
	/** Unique identifier for this handler (e.g., 'core:if-else') */
	readonly id: string;
	/** Human-readable name for this handler */
	readonly name: string;
	/**
	 * Priority for handler selection (higher checked first).
	 * Default is 0.
	 */
	readonly priority?: number;

	/**
	 * Check if this handler can process the input.
	 * @param input The input to check
	 * @returns true if this handler can process the input
	 */
	canHandle(input: unknown): input is TInput;

	/**
	 * Add nodes from the composite to the graph.
	 * @param input The composite input (guaranteed to pass canHandle)
	 * @param ctx Mutable context for adding nodes
	 * @returns The name of the head node (entry point)
	 */
	addNodes(input: TInput, ctx: MutablePluginContext): string;

	/**
	 * Handle .then() chaining from this composite (optional).
	 * Allows composites to define custom continuation behavior.
	 * @param input The composite input
	 * @param currentNode The current node name before chaining
	 * @param currentOutput The current output index
	 * @param ctx Mutable context for modifications
	 * @returns The new current node and output for continuation
	 */
	handleThen?(
		input: TInput,
		currentNode: string,
		currentOutput: number,
		ctx: MutablePluginContext,
	): { currentNode: string; currentOutput: number };
}

// =============================================================================
// Serializer Plugin
// =============================================================================

/**
 * A plugin that serializes workflow state to a specific format.
 *
 * Serializers transform the internal workflow representation into
 * output formats like JSON, YAML, or custom formats.
 *
 * @example
 * ```typescript
 * const jsonSerializer: SerializerPlugin<WorkflowJSON> = {
 *   id: 'core:json',
 *   name: 'JSON Serializer',
 *   format: 'json',
 *   serialize: (ctx) => ({
 *     id: ctx.workflowId,
 *     name: ctx.workflowName,
 *     nodes: [...ctx.nodes.values()].map(n => nodeToJSON(n)),
 *     connections: buildConnections(ctx),
 *     settings: ctx.settings,
 *   }),
 * };
 * ```
 */
export interface SerializerPlugin<TOutput = unknown> {
	/** Unique identifier for this serializer (e.g., 'core:json') */
	readonly id: string;
	/** Human-readable name for this serializer */
	readonly name: string;
	/** Format identifier used to select this serializer */
	readonly format: string;

	/**
	 * Serialize the workflow to the target format.
	 * @param ctx Plugin context with workflow state
	 * @returns The serialized workflow in the target format
	 */
	serialize(ctx: PluginContext): TOutput;
}
