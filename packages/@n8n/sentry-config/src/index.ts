/**
 * @n8n/sentry-config
 *
 * Centralized Sentry filters and beforeSend composition for n8n.
 *
 * This package provides:
 * - Pre-composed beforeSend functions for backend and frontend
 * - Individual filter functions for custom composition
 * - Type definitions for Sentry integration
 *
 * Usage:
 * ```typescript
 * import { createBackendBeforeSend } from '@n8n/sentry-config';
 *
 * Sentry.init({
 *   beforeSend: createBackendBeforeSend(),
 * });
 * ```
 *
 * Adding new filters:
 * 1. Add filter function to appropriate module (backend.ts, frontend.ts, etc.)
 * 2. Export from filters/index.ts
 * 3. Add to the relevant createXxxBeforeSend function
 */

// Export composed beforeSend/filter functions
export {
	createBackendBeforeSend,
	createFrontendBeforeSend,
	createTaskRunnerFilter,
} from './filters';

// Export individual filters for custom composition
export {
	// Backend filters
	extractEventDetailsFromN8nError,
	hasIgnoredCause,
	isIgnoredN8nError,
	isIgnoredSqliteError,
	shouldNotReportBaseError,
	// Frontend filters
	DEFAULT_IGNORED_ERRORS,
	matchesIgnoredPattern,
	// Shared filters
	isAxiosError,
	// Task runner filters (kept for backwards compat / direct use)
	filterOutUserCodeErrors,
	isUserCodeError,
} from './filters';

// Export types
export type {
	BeforeSend,
	BeforeSendFilterOptions,
	ErrorEvent,
	ErrorFilter,
	EventHint,
	Exception,
	IgnoredErrorPattern,
} from './types';
