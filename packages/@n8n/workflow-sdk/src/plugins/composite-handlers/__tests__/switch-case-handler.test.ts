import { switchCaseHandler } from '../switch-case-handler';
import type { SwitchCaseComposite, NodeInstance } from '../../../types/base';

// Helper to create a mock switch node
function createMockSwitchNode(): NodeInstance<string, string, unknown> {
	return {
		type: 'n8n-nodes-base.switch',
		name: 'Switch Node',
		version: '3',
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

// Helper to create a mock SwitchCaseComposite
function createSwitchCaseComposite(): SwitchCaseComposite {
	return {
		_isSwitchCaseComposite: true,
		switchNode: createMockSwitchNode(),
		cases: [createMockNode('Case 0'), createMockNode('Case 1')],
	} as SwitchCaseComposite;
}

describe('switchCaseHandler', () => {
	describe('metadata', () => {
		it('has correct id', () => {
			expect(switchCaseHandler.id).toBe('core:switch-case');
		});

		it('has correct name', () => {
			expect(switchCaseHandler.name).toBe('Switch/Case Handler');
		});

		it('has high priority', () => {
			expect(switchCaseHandler.priority).toBeGreaterThanOrEqual(100);
		});
	});

	describe('canHandle', () => {
		it('returns true for SwitchCaseComposite', () => {
			const composite = createSwitchCaseComposite();
			expect(switchCaseHandler.canHandle(composite)).toBe(true);
		});

		it('returns false for regular NodeInstance', () => {
			const node = createMockNode('Regular Node');
			expect(switchCaseHandler.canHandle(node)).toBe(false);
		});

		it('returns false for null', () => {
			expect(switchCaseHandler.canHandle(null)).toBe(false);
		});

		it('returns false for undefined', () => {
			expect(switchCaseHandler.canHandle(undefined)).toBe(false);
		});
	});
});
