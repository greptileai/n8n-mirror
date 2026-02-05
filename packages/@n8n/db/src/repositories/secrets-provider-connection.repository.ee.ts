import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

import { SecretsProviderConnection } from '../entities';

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
	 * @param loadRelations - Whether to load projectAccess relation. Default: true
	 */
	async findGlobalConnections(loadRelations = true): Promise<SecretsProviderConnection[]> {
		const qb = this.createQueryBuilder('connection');

		// Always need LEFT JOIN for WHERE clause, but only SELECT if relations requested
		if (loadRelations) {
			qb.leftJoinAndSelect('connection.projectAccess', 'access');
		} else {
			qb.leftJoin('connection.projectAccess', 'access');
		}

		return await qb
			.where('access.secretsProviderConnectionId IS NULL')
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();
	}

	/**
	 * Find all enabled connections that have access to a specific project
	 * @param projectId - The project ID to filter by
	 * @param loadRelations - Whether to load projectAccess and nested project relations. Default: true
	 */
	async findByProjectId(
		projectId: string,
		loadRelations = true,
	): Promise<SecretsProviderConnection[]> {
		const qb = this.createQueryBuilder('connection');

		if (loadRelations) {
			qb.leftJoinAndSelect('connection.projectAccess', 'projectAccess').leftJoinAndSelect(
				'projectAccess.project',
				'project',
			);
		} else {
			qb.innerJoin('connection.projectAccess', 'access');
		}

		return await qb
			.where('access.projectId = :projectId', { projectId })
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();
	}

	/**
	 * Find all connections accessible to a project:
	 * - Connections specifically shared with this project
	 * - Global connections (those with no project assignments)
	 */
	async findAllAccessibleByProject(
		projectId: string,
		loadRelations = true,
	): Promise<SecretsProviderConnection[]> {
		const projectConnections = await this.findByProjectId(projectId, loadRelations);
		const globalConnections = await this.findGlobalConnections(loadRelations);
		return projectConnections.concat(globalConnections);
	}
}
