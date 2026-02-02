import { mock } from 'jest-mock-extended';
import type { ITriggerFunctions } from 'n8n-workflow';

import { getAutoCommitSettings, type KafkaTriggerOptions } from '../utils';

describe('Kafka Utils', () => {
	describe('getAutoCommitSettings', () => {
		const createMockContext = (params: Record<string, unknown> = {}) => {
			const ctx = mock<ITriggerFunctions>();
			ctx.getNodeParameter.mockImplementation(
				(name: string, fallback?: unknown) => (params[name] ?? fallback) as never,
			);
			return ctx;
		};

		it('should return autoCommit true for version < 1.3', () => {
			const ctx = createMockContext();
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(ctx, options, 1);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});

		it('should return autoCommit true for version 1.1', () => {
			const ctx = createMockContext();
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(ctx, options, 1.1);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});

		it('should return autoCommit true for version 1.3 when resolveOffset is immediately', () => {
			const ctx = createMockContext({ resolveOffset: 'immediately' });
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});

		it('should return autoCommit true for version 1.3 when resolveOffset is immediately and autoCommitInterval is provided', () => {
			const ctx = createMockContext({ resolveOffset: 'immediately' });
			const options: KafkaTriggerOptions = {
				autoCommitInterval: 5000,
			};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: 5000,
				autoCommitThreshold: undefined,
			});
		});

		it('should return autoCommit true for version 1.3 when resolveOffset is immediately and autoCommitThreshold is provided', () => {
			const ctx = createMockContext({ resolveOffset: 'immediately' });
			const options: KafkaTriggerOptions = {
				autoCommitThreshold: 100,
			};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: undefined,
				autoCommitThreshold: 100,
			});
		});

		it('should return autoCommit true for version 1.3 when resolveOffset is immediately and both autoCommit options are provided', () => {
			const ctx = createMockContext({ resolveOffset: 'immediately' });
			const options: KafkaTriggerOptions = {
				autoCommitInterval: 5000,
				autoCommitThreshold: 100,
			};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: 5000,
				autoCommitThreshold: 100,
			});
		});

		it('should return autoCommit true for version 1.3 when resolveOffset is onCompletion', () => {
			const ctx = createMockContext({
				resolveOffset: 'onCompletion',
			});
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});

		it('should return autoCommit false for version 1.3 when resolveOffset is onSuccess', () => {
			const ctx = createMockContext({
				resolveOffset: 'onSuccess',
			});
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: false,
				eachBatchAutoResolve: false,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});

		it('should return autoCommit false for version 1.3 when resolveOffset is onStatus', () => {
			const ctx = createMockContext({
				resolveOffset: 'onStatus',
			});
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: false,
				eachBatchAutoResolve: false,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});

		it('should return autoCommit true for version 1.3 in manual mode regardless of resolveOffset', () => {
			const ctx = createMockContext({
				resolveOffset: 'onSuccess',
			});
			ctx.getMode.mockReturnValue('manual');
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});

		it('should return autoCommit true for version 1.3 in manual mode with onStatus resolveOffset', () => {
			const ctx = createMockContext({
				resolveOffset: 'onStatus',
			});
			ctx.getMode.mockReturnValue('manual');
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(ctx, options, 1.3);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});

		it('should pass through autoCommit options for version < 1.3', () => {
			const ctx = createMockContext();
			const options: KafkaTriggerOptions = {
				autoCommitInterval: 5000,
				autoCommitThreshold: 100,
			};
			const result = getAutoCommitSettings(ctx, options, 1);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: true,
				autoCommitInterval: 5000,
				autoCommitThreshold: 100,
			});
		});
	});
});
