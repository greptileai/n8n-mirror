import type { Message } from './message';
import type { ToolCall } from './tool';

export type FinishReason = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	inputTokenDetails?: {
		cacheRead?: number;
	};
	outputTokenDetails?: {
		reasoning?: number;
	};
	[key: string]: unknown;
}

export interface GenerateResult {
	id?: string;
	text: string;
	finishReason?: FinishReason;
	usage?: TokenUsage;
	/**
	 * Tool calls made by the model
	 */
	toolCalls?: ToolCall[];
	/**
	 * The generated message
	 */
	message?: Message;
	/**
	 * Metadata about the response from the provider
	 */
	providerMetadata?: Record<string, unknown>;
	rawResponse?: unknown;
}

export interface StreamChunk {
	type: 'text-delta' | 'tool-call-delta' | 'finish' | 'error';
	textDelta?: string;
	toolCallDelta?: {
		id?: string;
		name?: string;
		argumentsDelta?: string;
	};
	finishReason?: FinishReason;
	usage?: TokenUsage;
	error?: unknown;
}
