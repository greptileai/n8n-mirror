/**
 * Merge Composite Handler Plugin
 *
 * Handles MergeComposite structures - merging multiple branches.
 */

import type { CompositeHandlerPlugin, MutablePluginContext } from '../types';
import type { MergeComposite, NodeInstance, ConnectionTarget } from '../../types/base';
import { isMergeComposite } from '../../workflow-builder/type-guards';

/**
 * Handler for Merge composite structures.
 *
 * Recognizes MergeComposite patterns and adds the merge node and its branches
 * to the workflow graph.
 */
export const mergeHandler: CompositeHandlerPlugin<
	MergeComposite<NodeInstance<string, string, unknown>[]>
> = {
	id: 'core:merge',
	name: 'Merge Handler',
	priority: 100,

	canHandle(input: unknown): input is MergeComposite<NodeInstance<string, string, unknown>[]> {
		return isMergeComposite(input);
	},

	addNodes(
		input: MergeComposite<NodeInstance<string, string, unknown>[]>,
		ctx: MutablePluginContext,
	): string {
		// Add the merge node first (without connections - branches connect TO it)
		const mergeConns = new Map<string, Map<number, ConnectionTarget[]>>();
		mergeConns.set('main', new Map());
		ctx.nodes.set(input.mergeNode.name, {
			instance: input.mergeNode,
			connections: mergeConns,
		});

		// Add all branch nodes with connections TO the merge node at different input indices
		input.branches.forEach((branch, index) => {
			if (branch === null) {
				return; // Skip null branches - no connection for this input
			}

			// Add the branch node
			const branchHead = ctx.addBranchToGraph(branch);

			// Create connection from branch output 0 to merge at this input index
			const branchNode = ctx.nodes.get(branchHead);
			if (branchNode) {
				const mainConns = branchNode.connections.get('main') || new Map();
				mainConns.set(0, [{ node: input.mergeNode.name, type: 'main', index }]);
				branchNode.connections.set('main', mainConns);
			}
		});

		// Return the merge node name as the head of this composite
		return input.mergeNode.name;
	},
};
