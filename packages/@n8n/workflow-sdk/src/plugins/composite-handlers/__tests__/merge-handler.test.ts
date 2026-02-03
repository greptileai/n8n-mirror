import { mergeHandler } from '../merge-handler';
import type { MergeComposite, NodeInstance, GraphNode } from '../../../types/base';
import type { MutablePluginContext } from '../../types';

// Helper to create a mock merge node
function createMockMergeNode(name = 'Merge Node'): NodeInstance<string, string, unknown> {
	return {
		type: 'n8n-nodes-base.merge',
		name,
		version: '3',
		config: { parameters: { mode: 'combine' } },
	} as unknown as NodeInstance<string, string, unknown>;
}

// Helper to create a mock node
function createMockNode(name: string): NodeInstance<string, string, unknown> {
	return {
		type: 'n8n-nodes-base.set',
		name,
		version: '1',
		config: { parameters: {} },
	} as NodeInstance<string, string, unknown>;
}

// Helper to create a mock MergeComposite
function createMergeComposite(
	options: {
		mergeNodeName?: string;
		branches?: (NodeInstance<string, string, unknown> | null)[];
	} = {},
): MergeComposite<NodeInstance<string, string, unknown>[]> {
	return {
		_isMergeComposite: true,
		mergeNode: createMockMergeNode(options.mergeNodeName),
		branches: options.branches ?? [createMockNode('Branch 1'), createMockNode('Branch 2')],
		mode: 'combine',
	} as unknown as MergeComposite<NodeInstance<string, string, unknown>[]>;
}

// Helper to create a mock MutablePluginContext
function createMockContext(): MutablePluginContext {
	const nodes = new Map<string, GraphNode>();
	return {
		nodes,
		workflowId: 'test-workflow',
		workflowName: 'Test Workflow',
		settings: {},
		addNodeWithSubnodes: jest.fn((node: NodeInstance<string, string, unknown>) => {
			nodes.set(node.name, {
				instance: node,
				connections: new Map(),
			});
			return node.name;
		}),
		addBranchToGraph: jest.fn((branch: unknown) => {
			const branchNode = branch as NodeInstance<string, string, unknown>;
			nodes.set(branchNode.name, {
				instance: branchNode,
				connections: new Map(),
			});
			return branchNode.name;
		}),
	};
}

describe('mergeHandler', () => {
	describe('metadata', () => {
		it('has correct id', () => {
			expect(mergeHandler.id).toBe('core:merge');
		});

		it('has correct name', () => {
			expect(mergeHandler.name).toBe('Merge Handler');
		});

		it('has high priority', () => {
			expect(mergeHandler.priority).toBeGreaterThanOrEqual(100);
		});
	});

	describe('canHandle', () => {
		it('returns true for MergeComposite', () => {
			const composite = createMergeComposite();
			expect(mergeHandler.canHandle(composite)).toBe(true);
		});

		it('returns false for regular NodeInstance', () => {
			const node = createMockNode('Regular Node');
			expect(mergeHandler.canHandle(node)).toBe(false);
		});

		it('returns false for null', () => {
			expect(mergeHandler.canHandle(null)).toBe(false);
		});

		it('returns false for undefined', () => {
			expect(mergeHandler.canHandle(undefined)).toBe(false);
		});
	});

	describe('addNodes', () => {
		it('returns the Merge node name as head', () => {
			const composite = createMergeComposite({ mergeNodeName: 'My Merge' });
			const ctx = createMockContext();

			const headName = mergeHandler.addNodes(composite, ctx);

			expect(headName).toBe('My Merge');
		});

		it('adds Merge node to the context nodes map', () => {
			const composite = createMergeComposite();
			const ctx = createMockContext();

			mergeHandler.addNodes(composite, ctx);

			expect(ctx.nodes.has('Merge Node')).toBe(true);
			expect(ctx.nodes.get('Merge Node')?.instance).toBe(composite.mergeNode);
		});

		it('adds branch nodes using addBranchToGraph', () => {
			const branch1 = createMockNode('Branch 1');
			const branch2 = createMockNode('Branch 2');
			const composite = createMergeComposite({ branches: [branch1, branch2] });
			const ctx = createMockContext();

			mergeHandler.addNodes(composite, ctx);

			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(branch1);
			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(branch2);
		});

		it('creates connections from branches to Merge at different input indices', () => {
			const branch1 = createMockNode('Branch 1');
			const branch2 = createMockNode('Branch 2');
			const composite = createMergeComposite({ branches: [branch1, branch2] });
			const ctx = createMockContext();

			mergeHandler.addNodes(composite, ctx);

			// Branch 1 should connect to merge at input 0
			const branch1Node = ctx.nodes.get('Branch 1');
			const branch1MainConns = branch1Node?.connections.get('main');
			expect(branch1MainConns?.get(0)).toContainEqual(
				expect.objectContaining({ node: 'Merge Node', type: 'main', index: 0 }),
			);

			// Branch 2 should connect to merge at input 1
			const branch2Node = ctx.nodes.get('Branch 2');
			const branch2MainConns = branch2Node?.connections.get('main');
			expect(branch2MainConns?.get(0)).toContainEqual(
				expect.objectContaining({ node: 'Merge Node', type: 'main', index: 1 }),
			);
		});

		it('creates connections for three branches at correct input indices', () => {
			const branch1 = createMockNode('Branch 1');
			const branch2 = createMockNode('Branch 2');
			const branch3 = createMockNode('Branch 3');
			const composite = createMergeComposite({ branches: [branch1, branch2, branch3] });
			const ctx = createMockContext();

			mergeHandler.addNodes(composite, ctx);

			// Branch 3 should connect to merge at input 2
			const branch3Node = ctx.nodes.get('Branch 3');
			const branch3MainConns = branch3Node?.connections.get('main');
			expect(branch3MainConns?.get(0)).toContainEqual(
				expect.objectContaining({ node: 'Merge Node', type: 'main', index: 2 }),
			);
		});

		it('skips null branches (no connection for that input)', () => {
			const branch2 = createMockNode('Branch 2');
			const composite = createMergeComposite({
				branches: [null, branch2] as (NodeInstance<string, string, unknown> | null)[],
			});
			const ctx = createMockContext();

			mergeHandler.addNodes(composite, ctx);

			// Only branch2 should be added
			expect(ctx.addBranchToGraph).toHaveBeenCalledTimes(1);
			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(branch2);

			// Branch 2 should connect at input 1 (its index in the array)
			const branch2Node = ctx.nodes.get('Branch 2');
			const branch2MainConns = branch2Node?.connections.get('main');
			expect(branch2MainConns?.get(0)).toContainEqual(
				expect.objectContaining({ node: 'Merge Node', type: 'main', index: 1 }),
			);
		});
	});
});
