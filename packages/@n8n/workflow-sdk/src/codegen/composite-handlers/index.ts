/**
 * Composite Handlers Index
 *
 * Re-exports all composite handler functions for building specific composite types.
 */

// Build utilities
export {
	type BuildContext,
	type DeferredInputConnection,
	type DeferredMergeDownstream,
	toVarName,
	createLeaf,
	createVarRef,
	shouldBeVariable,
	isMergeType,
	isSwitchType,
	extractInputIndex,
	getOutputIndex,
	getOutputSlotName,
	getAllFirstOutputTargets,
	hasErrorOutput,
	getErrorOutputTargets,
} from './build-utils';

// Composite handlers
export { buildIfElseComposite } from './if-else-handler';
export { buildSwitchCaseComposite } from './switch-case-handler';
export { buildMergeComposite } from './merge-handler';
export { buildSplitInBatchesComposite } from './sib-handler';
export { buildErrorHandler } from './error-handler';
