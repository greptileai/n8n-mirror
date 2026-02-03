/**
 * Merge Composite Handler Plugin
 *
 * Handles MergeComposite structures - merging multiple branches.
 */

import type { CompositeHandlerPlugin, MutablePluginContext } from '../types';
import type { MergeComposite, NodeInstance } from '../../types/base';
import { isMergeComposite } from '../../workflow-builder/type-guards';

/**
 * Handler for Merge composite structures.
 *
 * Recognizes MergeComposite patterns and adds the merge node and its branches
 * to the workflow graph.
 *
 * Note: The actual node addition logic is still handled by WorkflowBuilderImpl.
 * This handler provides the canHandle detection and addNodes interface for
 * future refactoring when the logic can be fully extracted.
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
		_ctx: MutablePluginContext,
	): string {
		// The actual implementation will be in WorkflowBuilderImpl for now.
		// This provides the interface for future extraction.
		// Return the merge node name as the head of this composite.
		return input.mergeNode.name;
	},
};
