import { AxiosError } from 'axios';

/**
 * Filters out AxiosError instances.
 * Used by both backend and frontend since HTTP errors from axios
 * are typically external/transient and not actionable.
 *
 * @returns true if the error should be filtered out
 */
export function isAxiosError(originalException: unknown): boolean {
	return originalException instanceof AxiosError;
}
