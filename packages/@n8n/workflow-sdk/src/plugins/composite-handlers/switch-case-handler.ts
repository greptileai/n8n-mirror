/**
 * Switch/Case Composite Handler Plugin
 *
 * Handles SwitchCaseComposite and SwitchCaseBuilder structures - switch/case branching patterns.
 */

import type { CompositeHandlerPlugin, MutablePluginContext } from '../types';
import type {
	SwitchCaseComposite,
	ConnectionTarget,
	NodeInstance,
	SwitchCaseBuilder,
} from '../../types/base';
import { isSwitchCaseComposite } from '../../workflow-builder/type-guards';
import { isSwitchCaseBuilder } from '../../node-builder';

/**
 * Type representing either Composite or Builder format
 */
type SwitchCaseInput = SwitchCaseComposite | SwitchCaseBuilder<unknown>;

/**
 * Helper to process a single case node (handles arrays for fan-out)
 */
function processCaseNode(
	caseNode: unknown,
	index: number,
	ctx: MutablePluginContext,
	switchMainConns: Map<number, ConnectionTarget[]>,
): void {
	if (caseNode === null || caseNode === undefined) {
		return; // Skip null cases - no connection for this output
	}

	// Check if caseNode is an array (fan-out pattern)
	if (Array.isArray(caseNode)) {
		// Fan-out: multiple parallel targets from this case
		const targets: ConnectionTarget[] = [];
		for (const branchNode of caseNode as (NodeInstance<string, string, unknown> | null)[]) {
			if (branchNode === null) continue;
			const branchHead = ctx.addBranchToGraph(branchNode);
			targets.push({ node: branchHead, type: 'main', index: 0 });
		}
		if (targets.length > 0) {
			switchMainConns.set(index, targets);
		}
	} else {
		const caseHeadName = ctx.addBranchToGraph(caseNode);
		switchMainConns.set(index, [{ node: caseHeadName, type: 'main', index: 0 }]);
	}
}

/**
 * Handler for Switch/Case composite structures.
 *
 * Recognizes SwitchCaseComposite and SwitchCaseBuilder patterns and adds the
 * switch node and its cases to the workflow graph.
 */
export const switchCaseHandler: CompositeHandlerPlugin<SwitchCaseInput> = {
	id: 'core:switch-case',
	name: 'Switch/Case Handler',
	priority: 100,

	canHandle(input: unknown): input is SwitchCaseInput {
		return isSwitchCaseComposite(input) || isSwitchCaseBuilder(input);
	},

	addNodes(input: SwitchCaseInput, ctx: MutablePluginContext): string {
		// Handle sourceChain if present (for trigger.to(switch).onCase() pattern)
		const builderWithChain = input as { sourceChain?: unknown };
		if (builderWithChain.sourceChain) {
			ctx.addBranchToGraph(builderWithChain.sourceChain);
		}

		// Build the switch node connections to its cases
		const switchMainConns = new Map<number, ConnectionTarget[]>();

		// Handle both SwitchCaseComposite (cases array) and SwitchCaseBuilder (caseMapping Map)
		if ('caseMapping' in input && input.caseMapping instanceof Map) {
			// SwitchCaseBuilder format: uses Map<number, CaseTarget>
			for (const [index, caseNode] of input.caseMapping) {
				processCaseNode(caseNode, index, ctx, switchMainConns);
			}
		} else if ('cases' in input && Array.isArray(input.cases)) {
			// SwitchCaseComposite format: uses array where index is output index
			input.cases.forEach((caseNode, index) => {
				processCaseNode(caseNode, index, ctx, switchMainConns);
			});
		}

		// Add the switch node with connections to cases
		const switchConns = new Map<string, Map<number, ConnectionTarget[]>>();
		switchConns.set('main', switchMainConns);
		ctx.nodes.set(input.switchNode.name, {
			instance: input.switchNode,
			connections: switchConns,
		});

		// Return the switch node name as the head of this composite
		return input.switchNode.name;
	},
};
