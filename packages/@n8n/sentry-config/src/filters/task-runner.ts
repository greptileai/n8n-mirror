import type { ErrorEvent, ErrorFilter, Exception } from '../types';

/**
 * Checks if an error originated from user-provided code based on stack trace:
 * - node:vm runInContext - VM execution
 * - evalmachine.<anonymous> - Evaluated code context
 * - VmCodeWrapper - n8n's code execution wrapper
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

function filterOutUserCodeErrors(event: ErrorEvent): boolean {
	const error = event?.exception?.values?.[0];
	return error ? isUserCodeError(error) : false;
}

export function createTaskRunnerFilter(): ErrorFilter {
	return (event: ErrorEvent, _hint): boolean => {
		if (filterOutUserCodeErrors(event)) return true;
		return false;
	};
}
