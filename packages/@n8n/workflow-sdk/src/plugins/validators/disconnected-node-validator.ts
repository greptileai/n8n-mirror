/**
 * Disconnected Node Validator (Stub)
 *
 * This validator is a placeholder for future extraction of disconnected node validation.
 *
 * Currently, disconnected node validation is handled inline in WorkflowBuilderImpl.validate()
 * because it needs to respect the `allowDisconnectedNodes` validation option, which is not
 * available to plugin validators via PluginContext.
 *
 * Full extraction will require extending PluginContext with validation options, or adding
 * a mechanism for validators to declare which options they need.
 *
 * @see WorkflowBuilderImpl.validate() for the actual implementation
 */

import type { ValidatorPlugin, ValidationIssue } from '../types';

/**
 * Stub validator for disconnected nodes.
 *
 * The actual disconnected node validation is performed inline in validate() to support
 * the `allowDisconnectedNodes` option. This stub ensures the validator ID is reserved
 * and available for future extraction when PluginContext is extended.
 */
export const disconnectedNodeValidator: ValidatorPlugin = {
	id: 'core:disconnected-node',
	name: 'Disconnected Node Validator',
	priority: 10,

	// Per-node validation - not used
	validateNode: (): ValidationIssue[] => [],

	// Workflow-level validation - delegated to inline check in validate()
	// which respects the allowDisconnectedNodes option
	validateWorkflow: (): ValidationIssue[] => [],
};
