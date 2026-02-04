/**
 * Tests for code-builder types
 *
 * Type-only tests to ensure types compile correctly.
 * These tests verify that the types are properly exported and can be used.
 */

import type { WorkflowCodeOutput, ParseAndValidateResult, ValidationWarning } from '../types';

describe('code-builder types', () => {
	describe('WorkflowCodeOutput', () => {
		it('should accept valid workflow code output', () => {
			const output: WorkflowCodeOutput = {
				workflowCode: 'const x = 1;',
			};
			expect(output.workflowCode).toBe('const x = 1;');
		});
	});

	describe('ParseAndValidateResult', () => {
		it('should accept valid parse and validate result', () => {
			const result: ParseAndValidateResult = {
				workflow: {
					id: 'test',
					name: 'Test Workflow',
					nodes: [],
					connections: {},
				},
				warnings: [],
			};
			expect(result.workflow.id).toBe('test');
			expect(result.warnings).toHaveLength(0);
		});

		it('should accept result with warnings', () => {
			const result: ParseAndValidateResult = {
				workflow: {
					id: 'test',
					name: 'Test Workflow',
					nodes: [],
					connections: {},
				},
				warnings: [
					{
						code: 'WARN001',
						message: 'Some warning',
						nodeName: 'Test Node',
						parameterPath: 'config.value',
					},
				],
			};
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0].code).toBe('WARN001');
		});
	});

	describe('ValidationWarning', () => {
		it('should accept warning with all fields', () => {
			const warning: ValidationWarning = {
				code: 'WARN001',
				message: 'Parameter is deprecated',
				nodeName: 'HTTP Request',
				parameterPath: 'authentication.type',
			};
			expect(warning.code).toBe('WARN001');
			expect(warning.nodeName).toBe('HTTP Request');
		});

		it('should accept warning with only required fields', () => {
			const warning: ValidationWarning = {
				code: 'WARN002',
				message: 'Missing description',
			};
			expect(warning.code).toBe('WARN002');
			expect(warning.nodeName).toBeUndefined();
			expect(warning.parameterPath).toBeUndefined();
		});
	});
});
