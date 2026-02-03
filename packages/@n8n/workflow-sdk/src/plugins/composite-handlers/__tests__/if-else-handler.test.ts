import { ifElseHandler } from '../if-else-handler';
import type { IfElseComposite, NodeInstance } from '../../../types/base';

// Helper to create a mock if node
function createMockIfNode(): NodeInstance<string, string, unknown> {
	return {
		type: 'n8n-nodes-base.if',
		name: 'If Node',
		version: '2',
		config: { parameters: {} },
	} as NodeInstance<string, string, unknown>;
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

// Helper to create a mock IfElseComposite
function createIfElseComposite(
	options: {
		trueBranch?: NodeInstance<string, string, unknown> | null;
		falseBranch?: NodeInstance<string, string, unknown> | null;
	} = {},
): IfElseComposite {
	return {
		_isIfElseComposite: true,
		ifNode: createMockIfNode(),
		trueBranch: options.trueBranch ?? createMockNode('True Branch'),
		falseBranch: options.falseBranch ?? createMockNode('False Branch'),
	} as IfElseComposite;
}

describe('ifElseHandler', () => {
	describe('metadata', () => {
		it('has correct id', () => {
			expect(ifElseHandler.id).toBe('core:if-else');
		});

		it('has correct name', () => {
			expect(ifElseHandler.name).toBe('If/Else Handler');
		});

		it('has high priority', () => {
			expect(ifElseHandler.priority).toBeGreaterThanOrEqual(100);
		});
	});

	describe('canHandle', () => {
		it('returns true for IfElseComposite', () => {
			const composite = createIfElseComposite();
			expect(ifElseHandler.canHandle(composite)).toBe(true);
		});

		it('returns false for regular NodeInstance', () => {
			const node = createMockNode('Regular Node');
			expect(ifElseHandler.canHandle(node)).toBe(false);
		});

		it('returns false for null', () => {
			expect(ifElseHandler.canHandle(null)).toBe(false);
		});

		it('returns false for undefined', () => {
			expect(ifElseHandler.canHandle(undefined)).toBe(false);
		});

		it('returns false for primitive values', () => {
			expect(ifElseHandler.canHandle('string')).toBe(false);
			expect(ifElseHandler.canHandle(123)).toBe(false);
		});
	});
});
