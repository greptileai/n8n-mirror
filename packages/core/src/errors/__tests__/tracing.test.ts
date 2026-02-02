import type { StartSpanOptions } from '@sentry/core';
import type Sentry from '@sentry/node';
import { mock } from 'jest-mock-extended';

import { EmptySpan, NoopTracing } from '../noop-tracing';
import { type Span, Tracing, type Tracer } from '../tracing';

describe('tracing', () => {
	let mockTracingImplementation: jest.Mocked<Tracer>;
	const tracing = new Tracing();
	const noopTracing = new NoopTracing();

	beforeEach(() => {
		mockTracingImplementation = {
			startSpan: jest.fn(),
		};

		tracing.setTracingImplementation(noopTracing);
	});

	describe('setTracingImplementation', () => {
		it('should set the tracing implementation', async () => {
			tracing.setTracingImplementation(mockTracingImplementation);

			const options: StartSpanOptions = { name: 'test-span' };
			const callback = jest.fn().mockResolvedValue('result');

			await tracing.startSpan(options, callback);

			expect(mockTracingImplementation.startSpan).toHaveBeenCalledWith(options, callback);
		});
	});

	describe('startSpan', () => {
		it('should delegate to the current implementation', async () => {
			mockTracingImplementation.startSpan.mockResolvedValue('test-result');
			tracing.setTracingImplementation(mockTracingImplementation);

			const options: StartSpanOptions = { name: 'test-span' };
			const callback = jest.fn().mockResolvedValue('callback-result');

			const result = await tracing.startSpan(options, callback);

			expect(mockTracingImplementation.startSpan).toHaveBeenCalledWith(options, callback);
			expect(result).toBe('test-result');
		});

		it('should use NoopTracing by default', async () => {
			const options: StartSpanOptions = { name: 'test-span' };
			const callback = jest.fn().mockResolvedValue('callback-result');

			const result = await tracing.startSpan(options, callback);

			expect(callback).toHaveBeenCalledWith(expect.any(EmptySpan));
			expect(result).toBe('callback-result');
		});

		it('should pass options correctly to implementation', async () => {
			tracing.setTracingImplementation(mockTracingImplementation);

			const options: StartSpanOptions = {
				name: 'complex-span',
				op: 'test.operation',
				attributes: {
					key1: 'value1',
					key2: 123,
				},
			};
			const callback = jest.fn();

			await tracing.startSpan(options, callback);

			expect(mockTracingImplementation.startSpan).toHaveBeenCalledWith(options, callback);
		});

		it('should handle async callbacks correctly', async () => {
			tracing.setTracingImplementation(mockTracingImplementation);

			const options: StartSpanOptions = { name: 'async-span' };
			const callback = jest.fn().mockImplementation(async (_span?: Sentry.Span) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return 'async-result';
			});

			mockTracingImplementation.startSpan.mockImplementation(async (_opts, cb) => {
				return await cb(mock<Span>());
			});

			const result = await tracing.startSpan(options, callback);

			expect(result).toBe('async-result');
		});

		it('should propagate errors from the callback', async () => {
			tracing.setTracingImplementation(mockTracingImplementation);

			const options: StartSpanOptions = { name: 'error-span' };
			const error = new Error('Callback error');
			const callback = jest.fn().mockRejectedValue(error);

			mockTracingImplementation.startSpan.mockImplementation(async (_opts, cb) => {
				return await cb(mock<Span>());
			});

			await expect(tracing.startSpan(options, callback)).rejects.toThrow('Callback error');
		});

		it('should propagate errors from the implementation', async () => {
			const error = new Error('Implementation error');
			mockTracingImplementation.startSpan.mockRejectedValue(error);
			tracing.setTracingImplementation(mockTracingImplementation);

			const options: StartSpanOptions = { name: 'error-span' };
			const callback = jest.fn();

			await expect(tracing.startSpan(options, callback)).rejects.toThrow('Implementation error');
		});
	});
});
