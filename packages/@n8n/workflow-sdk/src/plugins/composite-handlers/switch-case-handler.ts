/**
 * Switch/Case Composite Handler Plugin
 *
 * Handles SwitchCaseComposite structures - switch/case branching patterns.
 */

import type { CompositeHandlerPlugin, MutablePluginContext } from '../types';
import type { SwitchCaseComposite } from '../../types/base';
import { isSwitchCaseComposite } from '../../workflow-builder/type-guards';

/**
 * Handler for Switch/Case composite structures.
 *
 * Recognizes SwitchCaseComposite patterns and adds the switch node and its cases
 * to the workflow graph.
 *
 * Note: The actual node addition logic is still handled by WorkflowBuilderImpl.
 * This handler provides the canHandle detection and addNodes interface for
 * future refactoring when the logic can be fully extracted.
 */
export const switchCaseHandler: CompositeHandlerPlugin<SwitchCaseComposite> = {
	id: 'core:switch-case',
	name: 'Switch/Case Handler',
	priority: 100,

	canHandle(input: unknown): input is SwitchCaseComposite {
		return isSwitchCaseComposite(input);
	},

	addNodes(input: SwitchCaseComposite, _ctx: MutablePluginContext): string {
		// The actual implementation will be in WorkflowBuilderImpl for now.
		// This provides the interface for future extraction.
		// Return the switch node name as the head of this composite.
		return input.switchNode.name;
	},
};
