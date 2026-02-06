import { Service } from '@n8n/di';
import { DataSource, EntityManager, Repository } from '@n8n/typeorm';

import { ChatHubTool, type IChatHubTool } from './chat-hub-tool.entity';

@Service()
export class ChatHubToolRepository extends Repository<ChatHubTool> {
	constructor(dataSource: DataSource) {
		super(ChatHubTool, dataSource.manager);
	}

	async createTool(tool: Partial<IChatHubTool> & Pick<IChatHubTool, 'id'>, trx?: EntityManager) {
		const em = trx ?? this.manager;
		await em.insert(ChatHubTool, tool);
		return await em.findOneOrFail(ChatHubTool, {
			where: { id: tool.id },
		});
	}

	async updateTool(id: string, updates: Partial<IChatHubTool>, trx?: EntityManager) {
		const em = trx ?? this.manager;
		await em.update(ChatHubTool, { id }, updates);
		return await em.findOneOrFail(ChatHubTool, {
			where: { id },
		});
	}

	async deleteTool(id: string, trx?: EntityManager) {
		const em = trx ?? this.manager;
		return await em.delete(ChatHubTool, { id });
	}

	async getManyByUserId(userId: string) {
		return await this.find({
			where: { ownerId: userId },
			order: { createdAt: 'ASC' },
		});
	}

	async getOneById(id: string, userId: string, trx?: EntityManager) {
		const em = trx ?? this.manager;
		return await em.findOne(ChatHubTool, {
			where: { id, ownerId: userId },
		});
	}
}
