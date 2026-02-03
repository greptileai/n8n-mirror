import { jsonSerializer } from '../json-serializer';
import type { WorkflowJSON } from '../../../types/base';
import type { PluginContext } from '../../types';

// Helper to create a mock plugin context
function createMockPluginContext(overrides: Partial<PluginContext> = {}): PluginContext {
	return {
		nodes: new Map(),
		workflowId: 'test-workflow',
		workflowName: 'Test Workflow',
		settings: {},
		...overrides,
	};
}

describe('jsonSerializer', () => {
	describe('metadata', () => {
		it('has correct id', () => {
			expect(jsonSerializer.id).toBe('core:json');
		});

		it('has correct name', () => {
			expect(jsonSerializer.name).toBe('JSON Serializer');
		});

		it('format is json', () => {
			expect(jsonSerializer.format).toBe('json');
		});
	});

	describe('serialize', () => {
		it('returns WorkflowJSON with id and name', () => {
			const ctx = createMockPluginContext({
				workflowId: 'wf-1',
				workflowName: 'My Workflow',
			});

			const result = jsonSerializer.serialize(ctx) as WorkflowJSON;

			expect(result.id).toBe('wf-1');
			expect(result.name).toBe('My Workflow');
		});

		it('includes settings in output', () => {
			const ctx = createMockPluginContext({
				settings: { timezone: 'UTC', executionTimeout: 300 },
			});

			const result = jsonSerializer.serialize(ctx) as WorkflowJSON;

			expect(result.settings).toEqual({ timezone: 'UTC', executionTimeout: 300 });
		});

		it('includes pinData in output when present', () => {
			const ctx = createMockPluginContext({
				pinData: { 'Node 1': [{ key: 'value' }] },
			});

			const result = jsonSerializer.serialize(ctx) as WorkflowJSON;

			expect(result.pinData).toEqual({ 'Node 1': [{ key: 'value' }] });
		});

		it('excludes pinData from output when not present', () => {
			const ctx = createMockPluginContext({
				pinData: undefined,
			});

			const result = jsonSerializer.serialize(ctx) as WorkflowJSON;

			expect(result.pinData).toBeUndefined();
		});

		it('returns empty nodes array when no nodes', () => {
			const ctx = createMockPluginContext({
				nodes: new Map(),
			});

			const result = jsonSerializer.serialize(ctx) as WorkflowJSON;

			expect(result.nodes).toEqual([]);
		});

		it('returns empty connections object when no nodes', () => {
			const ctx = createMockPluginContext({
				nodes: new Map(),
			});

			const result = jsonSerializer.serialize(ctx) as WorkflowJSON;

			expect(result.connections).toEqual({});
		});
	});
});
