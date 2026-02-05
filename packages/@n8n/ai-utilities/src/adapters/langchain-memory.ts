import { BaseChatMemory as LangchainBaseChatMemory } from '@langchain/community/memory/chat_memory';
import { ChatMessageHistory as LangchainChatMessageHistory } from '@langchain/community/stores/message/in_memory';
import type { BaseChatMessageHistory as LangchainBaseChatMessageHistory } from '@langchain/core/chat_history';
import type { InputValues, MemoryVariables, OutputValues } from '@langchain/core/memory';
import {
	AIMessage,
	HumanMessage,
	SystemMessage,
	ToolMessage,
	type BaseMessage,
} from '@langchain/core/messages';

import type { ChatMemory } from '../types/memory';
import type { Message, MessageContent } from '../types/message';

function toLC(message: Message): BaseMessage {
	const text = message.content
		.filter((c): c is MessageContent & { type: 'text' } => c.type === 'text')
		.map((c) => c.text)
		.join('');

	switch (message.role) {
		case 'system':
			return new SystemMessage(text);
		case 'human':
			return new HumanMessage(text);
		case 'ai':
			return new AIMessage(text);
		case 'tool': {
			const toolResult = message.content.find((c) => c.type === 'tool-result');
			if (toolResult && 'toolCallId' in toolResult) {
				return new ToolMessage({
					content:
						typeof toolResult.result === 'string'
							? toolResult.result
							: JSON.stringify(toolResult.result),
					tool_call_id: toolResult.toolCallId,
				});
			}
			return new AIMessage(text);
		}
		default:
			return new HumanMessage(text);
	}
}

/** Internal adapter - used by supplyMemory() */
export class LangchainMemoryAdapter extends LangchainBaseChatMemory {
	private readonly n8nMemory: ChatMemory;
	override chatHistory: LangchainBaseChatMessageHistory;

	constructor(memory: ChatMemory) {
		super({
			returnMessages: true,
			inputKey: 'input',
			outputKey: 'output',
		});
		this.n8nMemory = memory;
		this.chatHistory = new LangchainChatMessageHistory();
	}

	get memoryKeys(): string[] {
		return ['chat_history'];
	}

	async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
		const messages = await this.n8nMemory.loadMessages();
		const lcMessages = messages.map(toLC);

		await this.chatHistory.clear();
		await this.chatHistory.addMessages(lcMessages);

		return {
			chat_history: lcMessages,
		};
	}

	async saveContext(inputValues: InputValues, outputValues: OutputValues): Promise<void> {
		const input = inputValues.input as string;
		const output = outputValues.output as string;
		await this.n8nMemory.saveContext(input, output);
	}

	async clear(): Promise<void> {
		await this.n8nMemory.clear();
		await this.chatHistory.clear();
	}
}
