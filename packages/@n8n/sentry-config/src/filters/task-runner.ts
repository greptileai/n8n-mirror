import type { ErrorEvent, ErrorFilter, Exception } from '../types';

/**
 * Checks if an error originated from user-provided code.
 * User code errors come from the VM execution context and should not
 * be reported to Sentry as they are not platform bugs.
 *
 * Detection is based on stack trace analysis:
 * - node:vm runInContext - VM execution
 * - evalmachine.<anonymous> - Evaluated code context
 * - VmCodeWrapper - n8n's code execution wrapper
 *
 * @returns true if the error is from user code and should be filtered out
 */
export function isUserCodeError(error: Exception): boolean {
	const frames = error.stacktrace?.frames;
	if (!frames) return false;

	return frames.some((frame) => {
		if (frame.filename === 'node:vm' && frame.function === 'runInContext') {
			return true;
		}

		if (frame.filename === 'evalmachine.<anonymous>') {
			return true;
		}

		if (frame.function === 'VmCodeWrapper') {
			return true;
		}

		return false;
	});
}

/**
 * Filter function for task runner that filters out user code errors.
 *
 * @returns true if the error should be filtered out
 */
export function filterOutUserCodeErrors(event: ErrorEvent): boolean {
	const error = event?.exception?.values?.[0];
	return error ? isUserCodeError(error) : false;
}

/**
 * Creates a composed filter for the task runner.
 * Combines all task-runner-specific filters into a single ErrorFilter.
 *
 * This is the recommended way for task runner to integrate with sentry-config.
 * Add new task-runner-specific filters here.
 *
 * @returns An ErrorFilter to pass to ErrorReporter.init({ beforeSendFilter })
 */
export function createTaskRunnerFilter(): ErrorFilter {
	return (event: ErrorEvent, _hint): boolean => {
		// Filter out user code errors (VM execution)
		if (filterOutUserCodeErrors(event)) return true;

		// Add future task-runner-specific filters here
		// if (someOtherTaskRunnerFilter(event, hint)) return true;

		return false;
	};
}
