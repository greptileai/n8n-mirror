import {
	createTaskRunnerFilter,
	filterOutUserCodeErrors,
	isUserCodeError,
} from '../filters/task-runner';
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
			const exception: Exception = {
				stacktrace: {},
			};

			expect(isUserCodeError(exception)).toBe(false);
		});

		it('should return false for empty frames array', () => {
			const exception: Exception = {
				stacktrace: {
					frames: [],
				},
			};

			expect(isUserCodeError(exception)).toBe(false);
		});
	});

	describe('filterOutUserCodeErrors', () => {
		it('should return true for user code error in event', () => {
			const event: ErrorEvent = {
				type: undefined,
				event_id: '123',
				exception: {
					values: [
						{
							type: 'ReferenceError',
							value: 'fetch is not defined',
							stacktrace: {
								frames: [
									{ filename: 'node:vm', function: 'runInContext' },
									{ filename: 'evalmachine.<anonymous>', function: 'VmCodeWrapper' },
								],
							},
						},
					],
				},
			};

			expect(filterOutUserCodeErrors(event)).toBe(true);
		});

		it('should return false for platform error in event', () => {
			const event: ErrorEvent = {
				type: undefined,
				event_id: '123',
				exception: {
					values: [
						{
							type: 'Error',
							value: 'Internal error',
							stacktrace: {
								frames: [
									{ filename: 'app:///dist/runner.js', function: 'executeTask' },
									{ filename: 'app:///dist/runner.js', function: 'runForAllItems' },
								],
							},
						},
					],
				},
			};

			expect(filterOutUserCodeErrors(event)).toBe(false);
		});

		it('should return false when no exception', () => {
			const event: ErrorEvent = { type: undefined, event_id: '123' };

			expect(filterOutUserCodeErrors(event)).toBe(false);
		});

		it('should return false when no exception values', () => {
			const event: ErrorEvent = {
				type: undefined,
				event_id: '123',
				exception: {},
			};

			expect(filterOutUserCodeErrors(event)).toBe(false);
		});

		it('should return false when exception values is empty', () => {
			const event: ErrorEvent = {
				type: undefined,
				event_id: '123',
				exception: { values: [] },
			};

			expect(filterOutUserCodeErrors(event)).toBe(false);
		});

		it('should return false for null event', () => {
			expect(filterOutUserCodeErrors(null as unknown as ErrorEvent)).toBe(false);
		});

		it('should return false for undefined event', () => {
			expect(filterOutUserCodeErrors(undefined as unknown as ErrorEvent)).toBe(false);
		});

		it('should only check first exception value', () => {
			const event: ErrorEvent = {
				type: undefined,
				event_id: '123',
				exception: {
					values: [
						{
							type: 'Error',
							value: 'Platform error',
							stacktrace: {
								frames: [{ filename: 'app:///dist/runner.js', function: 'main' }],
							},
						},
						{
							type: 'Error',
							value: 'User code error',
							stacktrace: {
								frames: [{ filename: 'evalmachine.<anonymous>', function: 'userFn' }],
							},
						},
					],
				},
			};

			expect(filterOutUserCodeErrors(event)).toBe(false);
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

		it('should return a function', () => {
			const filter = createTaskRunnerFilter();
			expect(typeof filter).toBe('function');
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
			const event = createEvent();

			expect(filter(event, createHint())).toBe(false);
		});

		it('should match ErrorFilter signature', () => {
			const filter = createTaskRunnerFilter();
			const event = createEvent();
			const hint = createHint(new Error('test'));

			// Should accept both event and hint without type errors
			const result = filter(event, hint);
			expect(typeof result).toBe('boolean');
		});
	});
});
