// Control flow builders for branching and looping workflows

// IF/Else branching
export { ifBranch, type IfBranchConfig } from './if-branch';
export type { IfElseTarget } from './if-else';

// Switch/Case branching
export type { SwitchCaseTarget } from './switch-case';

// Split in batches looping
export {
	splitInBatches,
	isSplitInBatchesBuilder,
	type NodeBatch,
	type BranchTarget,
	type SplitInBatchesBranches,
} from './split-in-batches';

// Loop helpers
export { nextBatch, isNextBatch, type NextBatchMarker } from './next-batch';

// Fan-in helpers
export { fanIn, isFanIn, type FanInSources } from './fan-in';
