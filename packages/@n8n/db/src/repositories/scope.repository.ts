import { Logger } from '@n8n/backend-common';
import { Service } from '@n8n/di';
import { DataSource, In, Repository } from '@n8n/typeorm';

import { Scope } from '../entities';

@Service()
export class ScopeRepository extends Repository<Scope> {
	constructor(
		dataSource: DataSource,
		private readonly logger: Logger,
	) {
		super(Scope, dataSource.manager);
	}

	async findByList(slugs: string[]) {
		return await this.findBy({ slug: In(slugs) });
	}

	async findByListOrFail(slugs: string[]) {
		const scopes = await this.findBy({ slug: In(slugs) });
		if (scopes.length !== slugs.length) {
			const invalidScopes = slugs.filter((slug) => !scopes.some((s) => s.slug === slug));
			this.logger.error(`The following scopes are invalid: ${invalidScopes.join(', ')}`);
			throw new Error(`The following scopes are invalid: ${invalidScopes.join(', ')}`);
		}
		return scopes;
	}
}
