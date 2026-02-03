/**
 * If/Else Composite Handler Plugin
 *
 * Handles IfElseComposite structures - if/else branching patterns.
 */

import type { CompositeHandlerPlugin, MutablePluginContext } from '../types';
import type { IfElseComposite } from '../../types/base';
import { isIfElseComposite } from '../../workflow-builder/type-guards';

/**
 * Handler for If/Else composite structures.
 *
 * Recognizes IfElseComposite patterns and adds the if node and its branches
 * to the workflow graph.
 *
 * Note: The actual node addition logic is still handled by WorkflowBuilderImpl.
 * This handler provides the canHandle detection and addNodes interface for
 * future refactoring when the logic can be fully extracted.
 */
export const ifElseHandler: CompositeHandlerPlugin<IfElseComposite> = {
	id: 'core:if-else',
	name: 'If/Else Handler',
	priority: 100,

	canHandle(input: unknown): input is IfElseComposite {
		return isIfElseComposite(input);
	},

	addNodes(input: IfElseComposite, _ctx: MutablePluginContext): string {
		// The actual implementation will be in WorkflowBuilderImpl for now.
		// This provides the interface for future extraction.
		// Return the if node name as the head of this composite.
		return input.ifNode.name;
	},
};
