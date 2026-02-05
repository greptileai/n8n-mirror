import { SecretsProviderConnectionRepository } from '@n8n/db';
import { Service } from '@n8n/di';

@Service()
export class SecretsProviderAccessCheckService {
	constructor(private readonly connectionRepository: SecretsProviderConnectionRepository) {}

	async canAccessProviderFromProject(providerKey: string, projectId: string): Promise<boolean> {
		return await this.connectionRepository.hasAccessToProvider(providerKey, projectId);
	}
}
