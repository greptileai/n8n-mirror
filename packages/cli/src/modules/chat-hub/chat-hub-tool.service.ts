import type {
	ChatHubCreateToolRequest,
	ChatHubUpdateToolRequest,
	ChatHubToolDto,
} from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { EntityManager, withTransaction, type User } from '@n8n/db';
import { Service } from '@n8n/di';

import { NotFoundError } from '@/errors/response-errors/not-found.error';

import type { ChatHubTool } from './chat-hub-tool.entity';
import { ChatHubToolRepository } from './chat-hub-tool.repository';

@Service()
export class ChatHubToolService {
	constructor(
		private readonly logger: Logger,
		private readonly chatToolRepository: ChatHubToolRepository,
	) {
		this.logger = this.logger.scoped('chat-hub');
	}

	async getToolsByUserId(userId: string): Promise<ChatHubTool[]> {
		return await this.chatToolRepository.getManyByUserId(userId);
	}

	async createTool(user: User, data: ChatHubCreateToolRequest): Promise<ChatHubTool> {
		const definition = data.definition;

		const tool = await this.chatToolRepository.createTool({
			id: definition.id,
			name: definition.name,
			ownerId: user.id,
			definition,
			enabled: true,
		});

		this.logger.debug(`Chat hub tool created: ${tool.id} by user ${user.id}`);
		return tool;
	}

	async updateTool(
		id: string,
		user: User,
		updates: ChatHubUpdateToolRequest,
		trx?: EntityManager,
	): Promise<ChatHubTool> {
		const tool = await withTransaction(this.chatToolRepository.manager, trx, async (em) => {
			const existingTool = await this.chatToolRepository.getOneById(id, user.id, em);
			if (!existingTool) {
				throw new NotFoundError('Chat hub tool not found');
			}

			const updateData: Partial<ChatHubTool> = {};

			if (updates.definition !== undefined) {
				updateData.definition = updates.definition;
				updateData.name = updates.definition.name;
			}
			if (updates.enabled !== undefined) {
				updateData.enabled = updates.enabled;
			}

			return await this.chatToolRepository.updateTool(id, updateData, em);
		});

		this.logger.debug(`Chat hub tool updated: ${id} by user ${user.id}`);
		return tool;
	}

	async deleteTool(id: string, userId: string, trx?: EntityManager): Promise<void> {
		await withTransaction(this.chatToolRepository.manager, trx, async (em) => {
			const existingTool = await this.chatToolRepository.getOneById(id, userId, em);
			if (!existingTool) {
				throw new NotFoundError('Chat hub tool not found');
			}

			await this.chatToolRepository.deleteTool(id, em);
		});

		this.logger.debug(`Chat hub tool deleted: ${id} by user ${userId}`);
	}

	static toDto(tool: ChatHubTool): ChatHubToolDto {
		return {
			definition: tool.definition,
			enabled: tool.enabled,
		};
	}
}
