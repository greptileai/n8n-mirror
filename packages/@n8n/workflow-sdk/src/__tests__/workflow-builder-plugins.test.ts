/**
 * Tests for WorkflowBuilder plugin integration (Phase 6)
 *
 * These tests verify that the plugin system is properly integrated with
 * WorkflowBuilderImpl, allowing plugins to participate in validation,
 * composite handling, and serialization.
 */

import { workflow } from '../workflow-builder';
import { node, trigger } from '../node-builder';
import { PluginRegistry } from '../plugins/registry';
import type { ValidatorPlugin, PluginContext, SerializerPlugin } from '../plugins/types';
import type { WorkflowJSON } from '../types/base';
import { jsonSerializer } from '../plugins/serializers/json-serializer';

// Helper to create mock validators
function createMockValidator(
	id: string,
	nodeTypes: string[] = [],
	validateNodeFn: ValidatorPlugin['validateNode'] = () => [],
): ValidatorPlugin {
	return {
		id,
		name: `Mock Validator ${id}`,
		nodeTypes,
		validateNode: jest.fn(validateNodeFn),
	};
}

describe('WorkflowBuilder plugin integration', () => {
	let testRegistry: PluginRegistry;

	beforeEach(() => {
		testRegistry = new PluginRegistry();
	});

	describe('validate() with plugins', () => {
		it('runs registered validators for matching node types', () => {
			const mockValidateNode = jest.fn().mockReturnValue([]);
			const mockValidator = createMockValidator(
				'test:mock',
				['n8n-nodes-base.set'],
				mockValidateNode,
			);
			testRegistry.registerValidator(mockValidator);

			const setNode = node({
				type: 'n8n-nodes-base.set',
				version: 3.4,
				config: { name: 'Set Data', parameters: { values: [] } },
			});

			const wf = workflow('test', 'Test', { registry: testRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}).then(setNode),
			);

			wf.validate();

			expect(mockValidateNode).toHaveBeenCalled();
		});

		it('collects issues from all matching validators', () => {
			const validator1 = createMockValidator('test:v1', [], () => [
				{ code: 'V1_ISSUE', message: 'Issue 1', severity: 'warning' },
			]);
			const validator2 = createMockValidator('test:v2', [], () => [
				{ code: 'V2_ISSUE', message: 'Issue 2', severity: 'error' },
			]);
			testRegistry.registerValidator(validator1);
			testRegistry.registerValidator(validator2);

			const wf = workflow('test', 'Test', { registry: testRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}),
			);

			const result = wf.validate();

			// Cast to any to allow checking custom plugin codes
			expect(result.warnings.some((w) => (w.code as string) === 'V1_ISSUE')).toBe(true);
			expect(result.errors.some((e) => (e.code as string) === 'V2_ISSUE')).toBe(true);
		});

		it('validators receive correct PluginContext', () => {
			let receivedCtx: PluginContext | undefined;
			const mockValidator = createMockValidator('test:ctx', [], (_node, _graphNode, ctx) => {
				receivedCtx = ctx;
				return [];
			});
			testRegistry.registerValidator(mockValidator);

			const wf = workflow('wf-123', 'My Workflow', { registry: testRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}),
			);

			wf.validate();

			expect(receivedCtx).toBeDefined();
			expect(receivedCtx!.workflowId).toBe('wf-123');
			expect(receivedCtx!.workflowName).toBe('My Workflow');
			expect(receivedCtx!.nodes).toBeDefined();
		});

		it('validateWorkflow() hook is called after node validation', () => {
			const callOrder: string[] = [];
			const mockValidator: ValidatorPlugin = {
				id: 'test:hooks',
				name: 'Hook Validator',
				validateNode: () => {
					callOrder.push('validateNode');
					return [];
				},
				validateWorkflow: () => {
					callOrder.push('validateWorkflow');
					return [];
				},
			};
			testRegistry.registerValidator(mockValidator);

			const wf = workflow('test', 'Test', { registry: testRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}),
			);

			wf.validate();

			expect(callOrder).toContain('validateNode');
			expect(callOrder).toContain('validateWorkflow');
			// validateWorkflow should be called after all validateNode calls
			const nodeIdx = callOrder.indexOf('validateNode');
			const workflowIdx = callOrder.indexOf('validateWorkflow');
			expect(workflowIdx).toBeGreaterThan(nodeIdx);
		});

		it('skips validators that do not match node type', () => {
			const agentValidator = createMockValidator(
				'test:agent',
				['@n8n/n8n-nodes-langchain.agent'],
				() => [{ code: 'AGENT_ISSUE', message: 'Agent issue', severity: 'warning' }],
			);
			testRegistry.registerValidator(agentValidator);

			// Add a non-agent node
			const wf = workflow('test', 'Test', { registry: testRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}),
			);

			const result = wf.validate();

			// Agent validator should not have been called
			expect(agentValidator.validateNode).not.toHaveBeenCalled();
			expect(result.warnings.some((w) => (w.code as string) === 'AGENT_ISSUE')).toBe(false);
		});

		it('validators with empty nodeTypes run on all nodes', () => {
			const universalValidator = createMockValidator('test:universal', [], () => []);
			testRegistry.registerValidator(universalValidator);

			const wf = workflow('test', 'Test', { registry: testRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}).then(
					node({
						type: 'n8n-nodes-base.set',
						version: 3.4,
						config: { name: 'Set' },
					}),
				),
			);

			wf.validate();

			// Should be called once for each node (2 nodes)
			expect(universalValidator.validateNode).toHaveBeenCalledTimes(2);
		});
	});

	describe('toFormat()', () => {
		it('returns serialized output for registered format', () => {
			testRegistry.registerSerializer(jsonSerializer);

			const wf = workflow('wf-1', 'Test', { registry: testRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}),
			);

			const result = wf.toFormat<WorkflowJSON>('json');

			expect(result.id).toBe('wf-1');
			expect(result.name).toBe('Test');
		});

		it('throws for unknown format', () => {
			const wf = workflow('test', 'Test', { registry: testRegistry });

			expect(() => wf.toFormat('yaml')).toThrow("No serializer registered for format 'yaml'");
		});

		it('custom serializer can transform workflow', () => {
			const customSerializer: SerializerPlugin<string> = {
				id: 'test:custom',
				name: 'Custom Serializer',
				format: 'custom',
				serialize: (ctx) => `Workflow: ${ctx.workflowName} (${ctx.nodes.size} nodes)`,
			};
			testRegistry.registerSerializer(customSerializer);

			const wf = workflow('test', 'My Flow', { registry: testRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}),
			);

			const result = wf.toFormat<string>('custom');

			expect(result).toBe('Workflow: My Flow (1 nodes)');
		});
	});

	describe('workflow() factory with registry option', () => {
		it('accepts registry option', () => {
			const customRegistry = new PluginRegistry();
			const wf = workflow('test', 'Test', { registry: customRegistry });

			// Should not throw
			expect(wf).toBeDefined();
		});

		it('uses provided registry for validation', () => {
			const customRegistry = new PluginRegistry();
			const mockValidator = createMockValidator('custom:v1', [], () => [
				{ code: 'CUSTOM_ISSUE', message: 'Custom issue', severity: 'warning' },
			]);
			customRegistry.registerValidator(mockValidator);

			const wf = workflow('test', 'Test', { registry: customRegistry }).add(
				trigger({
					type: 'n8n-nodes-base.manualTrigger',
					version: 1,
					config: { name: 'Start' },
				}),
			);

			const result = wf.validate();

			expect(result.warnings.some((w) => (w.code as string) === 'CUSTOM_ISSUE')).toBe(true);
		});

		it('accepts both settings and registry', () => {
			const customRegistry = new PluginRegistry();
			const wf = workflow('test', 'Test', {
				settings: { timezone: 'UTC' },
				registry: customRegistry,
			});

			const json = wf.toJSON();
			expect(json.settings?.timezone).toBe('UTC');
		});
	});
});
