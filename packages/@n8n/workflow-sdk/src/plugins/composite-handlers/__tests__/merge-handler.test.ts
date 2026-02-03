import { mergeHandler } from '../merge-handler';
import type { MergeComposite, NodeInstance } from '../../../types/base';

// Helper to create a mock merge node
function createMockMergeNode(): NodeInstance<string, string, unknown> {
	return {
		type: 'n8n-nodes-base.merge',
		name: 'Merge Node',
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
function createMergeComposite(): MergeComposite<NodeInstance<string, string, unknown>[]> {
	return {
		_isMergeComposite: true,
		mergeNode: createMockMergeNode(),
		branches: [createMockNode('Branch 1'), createMockNode('Branch 2')],
	} as unknown as MergeComposite<NodeInstance<string, string, unknown>[]>;
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
});
