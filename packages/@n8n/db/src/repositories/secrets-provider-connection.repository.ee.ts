import { Service } from '@n8n/di';
import { Brackets, DataSource, Repository } from '@n8n/typeorm';

import { SecretsProviderConnection } from '../entities';

@Service()
export class SecretsProviderConnectionRepository extends Repository<SecretsProviderConnection> {
	constructor(dataSource: DataSource) {
		super(SecretsProviderConnection, dataSource.manager);
	}

	async findAll(): Promise<SecretsProviderConnection[]> {
		return await this.find();
	}

	async hasGlobalProvider(providerKey: string): Promise<boolean> {
		const count = await this.manager
			.createQueryBuilder(SecretsProviderConnection, 'connection')
			.leftJoin('connection.projectAccess', 'access')
			.where('access.secretsProviderConnectionId IS NULL')
			.andWhere('connection.providerKey = :providerKey', { providerKey })
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getCount();

		return count > 0;
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
		return await this.manager
			.createQueryBuilder(SecretsProviderConnection, 'connection')
			.innerJoin('connection.projectAccess', 'access')
			.where('access.projectId = :projectId', { projectId })
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();
	}

	/**
	 * Checks if a provider is accessible from a project.
	 * A provider is accessible if it's either:
	 * - A global provider (no project access restrictions), OR
	 * - Explicitly granted access to the specified project
	 */
	async hasAccessToProvider(providerKey: string, projectId: string): Promise<boolean> {
		const count = await this.manager
			.createQueryBuilder(SecretsProviderConnection, 'connection')
			.leftJoin('connection.projectAccess', 'access')
			.where('connection.providerKey = :providerKey', { providerKey })
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.andWhere(
				new Brackets((qb) => {
					qb.where('access.secretsProviderConnectionId IS NULL') // Global provider
						.orWhere('access.projectId = :projectId', { projectId }); // Project-specific
				}),
			)
			.getCount();

		return count > 0;
	}
}
