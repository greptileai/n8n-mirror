/**
 * Types for the Code Builder Agent
 *
 * Extracted from code-builder-agent.ts for better organization and testability.
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Logger } from '@n8n/backend-common';
import type { WorkflowJSON } from '@n8n/workflow-sdk';
import type { INodeTypeDescription } from 'n8n-workflow';

import type { EvaluationLogger } from '../utils/evaluation-logger';

/**
 * Structured output type for the LLM response
 */
export interface WorkflowCodeOutput {
	workflowCode: string;
}

/**
 * Validation warning with optional location info
 */
export interface ValidationWarning {
	code: string;
	message: string;
	nodeName?: string;
	parameterPath?: string;
}

/**
 * Result from parseAndValidate including workflow and any warnings
 */
export interface ParseAndValidateResult {
	workflow: WorkflowJSON;
	warnings: ValidationWarning[];
}

/**
 * Configuration for the code builder agent
 */
export interface CodeBuilderAgentConfig {
	/** LLM for generation */
	llm: BaseChatModel;
	/** Parsed node types from n8n */
	nodeTypes: INodeTypeDescription[];
	/** Optional logger */
	logger?: Logger;
	/**
	 * Path to the generated types directory (from InstanceSettings.generatedTypesDir).
	 * If not provided, falls back to workflow-sdk static types.
	 */
	generatedTypesDir?: string;
	/** Optional evaluation logger for capturing debug info during evals */
	evalLogger?: EvaluationLogger;
	/**
	 * Enable the text editor tool for targeted code edits.
	 * If not specified, auto-enabled for Claude 4.x models.
	 */
	enableTextEditor?: boolean;
}
