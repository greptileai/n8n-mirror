import { Logger } from '@n8n/backend-common';
import type { AuthenticatedRequest } from '@n8n/db';
import { Get, Middleware, Param, ProjectScope, RestController } from '@n8n/decorators';
import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError } from '@/errors/response-errors/forbidden.error';

import { ExternalSecretsConfig } from './external-secrets.config';
import { SecretsProvidersConnectionsService } from './secrets-providers-connections.service.ee';
import type { SecretsProvidersResponses } from './secrets-providers.responses.ee';

@RestController('/secret-providers/projects')
export class SecretProvidersProjectController {
	constructor(
		private readonly config: ExternalSecretsConfig,
		private readonly logger: Logger,
		private readonly connectionsService: SecretsProvidersConnectionsService,
	) {
		this.logger = this.logger.scoped('external-secrets');
	}

	@Middleware()
	checkFeatureFlag(_req: Request, _res: Response, next: NextFunction) {
		if (!this.config.externalSecretsForProjects) {
			this.logger.warn('External secrets for projects feature is not enabled');
			_res.status(403).send('External secrets for projects feature is not enabled');
			return;
		}
		next();
	}

	@Get('/:projectId/connections')
	@ProjectScope('externalSecretsProvider:list')
	async listConnectionsForAProject(
		_req: AuthenticatedRequest,
		_res: Response,
		@Param('projectId') projectId: string,
	): Promise<SecretsProvidersResponses.StrippedConnection[]> {
		this.logger.debug('List all connections within a project', { projectId });
		const connections = await this.connectionsService.listConnectionsForProject(projectId);
		return connections.map((c) => this.connectionsService.toPublicConnection(c));
	}
}
