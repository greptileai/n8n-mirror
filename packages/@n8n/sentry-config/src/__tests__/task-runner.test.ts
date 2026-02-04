import { createTaskRunnerFilter, isUserCodeError } from '../filters/task-runner';
import type { ErrorEvent, EventHint, Exception } from '../types';

describe('task-runner filters', () => {
	describe('isUserCodeError', () => {
		it('should return true for node:vm runInContext frame', () => {
			const exception: Exception = {
				stacktrace: {
					frames: [
						{ filename: 'app:///dist/runner.js', function: 'executeTask' },
						{ filename: 'node:vm', function: 'runInContext' },
					],
				},
			};

			expect(isUserCodeError(exception)).toBe(true);
		});

		it('should return true for evalmachine.<anonymous> frame', () => {
			const exception: Exception = {
				stacktrace: {
					frames: [
						{ filename: 'app:///dist/runner.js', function: 'executeTask' },
						{ filename: 'evalmachine.<anonymous>', function: 'userFunction' },
					],
				},
			};

			expect(isUserCodeError(exception)).toBe(true);
		});

		it('should return true for VmCodeWrapper function', () => {
			const exception: Exception = {
				stacktrace: {
					frames: [
						{ filename: 'app:///dist/runner.js', function: 'executeTask' },
						{ filename: 'evalmachine.<anonymous>', function: 'VmCodeWrapper' },
					],
				},
			};

			expect(isUserCodeError(exception)).toBe(true);
		});

		it('should return false for node:vm with different function', () => {
			const exception: Exception = {
				stacktrace: {
					frames: [{ filename: 'node:vm', function: 'createScript' }],
				},
			};

			expect(isUserCodeError(exception)).toBe(false);
		});

		it('should return false for app frames only', () => {
			const exception: Exception = {
				stacktrace: {
					frames: [
						{ filename: 'app:///dist/runner.js', function: 'executeTask' },
						{ filename: 'app:///dist/runner.js', function: 'runForAllItems' },
					],
				},
			};

			expect(isUserCodeError(exception)).toBe(false);
		});

		it('should return false when no stacktrace', () => {
			const exception: Exception = {};
			expect(isUserCodeError(exception)).toBe(false);
		});

		it('should return false when no frames', () => {
			const exception: Exception = { stacktrace: {} };
			expect(isUserCodeError(exception)).toBe(false);
		});

		it('should return false for empty frames array', () => {
			const exception: Exception = { stacktrace: { frames: [] } };
			expect(isUserCodeError(exception)).toBe(false);
		});
	});

	describe('createTaskRunnerFilter', () => {
		const createEvent = (exception?: Partial<ErrorEvent['exception']>): ErrorEvent => ({
			type: undefined,
			event_id: 'test-id',
			exception,
		});

		const createHint = (originalException?: unknown): EventHint => ({
			originalException,
		});

		it('should filter out user code errors', () => {
			const filter = createTaskRunnerFilter();
			const event = createEvent({
				values: [
					{
						stacktrace: {
							frames: [{ filename: 'evalmachine.<anonymous>', function: 'userFn' }],
						},
					},
				],
			});

			expect(filter(event, createHint())).toBe(true);
		});

		it('should not filter out platform errors', () => {
			const filter = createTaskRunnerFilter();
			const event = createEvent({
				values: [
					{
						stacktrace: {
							frames: [{ filename: 'app:///dist/runner.js', function: 'main' }],
						},
					},
				],
			});

			expect(filter(event, createHint())).toBe(false);
		});

		it('should not filter out errors without exception', () => {
			const filter = createTaskRunnerFilter();
			expect(filter(createEvent(), createHint())).toBe(false);
		});

		it('should not filter out errors with empty exception values', () => {
			const filter = createTaskRunnerFilter();
			expect(filter(createEvent({ values: [] }), createHint())).toBe(false);
		});

		it('should not filter out null/undefined events', () => {
			const filter = createTaskRunnerFilter();
			expect(filter(null as unknown as ErrorEvent, createHint())).toBe(false);
			expect(filter(undefined as unknown as ErrorEvent, createHint())).toBe(false);
		});
	});
});
