/**
 * JSON Serializer Plugin
 *
 * Serializes workflows to n8n's standard JSON format.
 */

import type { SerializerPlugin, PluginContext } from '../types';
import type { WorkflowJSON } from '../../types/base';

/**
 * Serializer for the standard n8n workflow JSON format.
 *
 * Produces WorkflowJSON output that can be imported into n8n.
 *
 * Note: The actual serialization logic for nodes and connections is still
 * handled by WorkflowBuilderImpl's toJSON method. This plugin provides the
 * interface for future extraction.
 */
export const jsonSerializer: SerializerPlugin<WorkflowJSON> = {
	id: 'core:json',
	name: 'JSON Serializer',
	format: 'json',

	serialize(ctx: PluginContext): WorkflowJSON {
		// Build the base workflow structure
		const result: WorkflowJSON = {
			id: ctx.workflowId,
			name: ctx.workflowName,
			nodes: [],
			connections: {},
			settings: ctx.settings,
		};

		// Include pinData if present
		if (ctx.pinData) {
			result.pinData = ctx.pinData;
		}

		// Note: Full node and connection serialization would be extracted here.
		// For now, the actual serialization is done by WorkflowBuilderImpl.toJSON()

		return result;
	},
};
