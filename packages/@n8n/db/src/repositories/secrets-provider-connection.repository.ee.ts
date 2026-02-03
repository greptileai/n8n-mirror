import { Service } from '@n8n/di';
import { DataSource, Repository, In } from '@n8n/typeorm';

import { ProjectSecretsProviderAccess, SecretsProviderConnection } from '../entities';

@Service()
export class SecretsProviderConnectionRepository extends Repository<SecretsProviderConnection> {
	constructor(dataSource: DataSource) {
		super(SecretsProviderConnection, dataSource.manager);
	}

	async findAll(): Promise<SecretsProviderConnection[]> {
		return await this.find();
	}

	/**
	 * Find all global connections (connections with no project access entries)
	 */
	async findGlobalConnections(): Promise<SecretsProviderConnection[]> {
		return await this.manager
			.createQueryBuilder(SecretsProviderConnection, 'connection')
			.leftJoin('connection.projectAccess', 'access')
			.where('access.secretsProviderConnectionId IS NULL')
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();
	}

	/**
	 * Find all enabled connections that have access to a specific project
	 */
	async findByProjectId(projectId: string): Promise<SecretsProviderConnection[]> {
		// Get connection IDs that have access to this project
		const accessRecords = await this.manager.find(ProjectSecretsProviderAccess, {
			where: { projectId },
			select: ['secretsProviderConnectionId'],
		});

		if (accessRecords.length === 0) {
			return [];
		}

		const connectionIds = accessRecords.map((r) => r.secretsProviderConnectionId);

		// Return enabled connections with the projectAccess relation loaded
		return await this.find({
			where: {
				id: In(connectionIds),
				isEnabled: true,
			},
			relations: ['projectAccess'],
		});
	}
}
