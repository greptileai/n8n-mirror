import type { SecretProviderTypeResponse, SecretsProviderType } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { Get, GlobalScope, Param, RestController, Middleware } from '@n8n/decorators';
import type { NextFunction, Request, Response } from 'express';

import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { NotFoundError } from '@/errors/response-errors/not-found.error';

import { ExternalSecretsProviders } from './external-secrets-providers.ee';
import { ExternalSecretsConfig } from './external-secrets.config';
import { SecretsProvider } from './types';

@RestController('/secret-providers/types')
export class SecretProvidersTypesController {
	constructor(
		private readonly config: ExternalSecretsConfig,
		private readonly logger: Logger,
		private readonly secretsProviders: ExternalSecretsProviders,
	) {
		this.logger = this.logger.scoped('external-secrets');
	}

	@Middleware()
	checkFeatureFlag(_req: Request, _res: Response, next: NextFunction) {
		if (!this.config.externalSecretsForProjects) {
			throw new BadRequestError('External secrets for projects feature is not enabled');
		}
		next();
	}

	@Get('/')
	@GlobalScope('externalSecretsProvider:list')
	listSecretProviderTypes(): SecretProviderTypeResponse[] {
		this.logger.debug('List provider connection types');
		const allProviders = this.secretsProviders.getAllProviders();
		return Object.entries(allProviders).map(([_name, providerClass]) => {
			const provider = new providerClass();
			return this.mapProviderToSecretProviderTypeResponse(provider);
		});
	}

	@Get('/:type')
	@GlobalScope('externalSecretsProvider:list')
	getSecretProviderType(@Param('type') type: string): SecretProviderTypeResponse {
		this.logger.debug('Get provider connection type', { type });
		if (!this.secretsProviders.hasProvider(type)) {
			throw new NotFoundError(`Provider type "${type}" not found`);
		}
		const providerClass = this.secretsProviders.getProvider(type);
		const provider = new providerClass();
		return this.mapProviderToSecretProviderTypeResponse(provider);
	}

	private mapProviderToSecretProviderTypeResponse(
		provider: SecretsProvider,
	): SecretProviderTypeResponse {
		return {
			type: provider.name as SecretsProviderType,
			displayName: provider.displayName,
			icon: provider.name,
			properties: provider.properties,
		};
	}
}
