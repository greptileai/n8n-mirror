import { Service } from '@n8n/di';

import { QuickConnectConfig } from './quick-connect.config';

@Service()
export class QuickConnectService {
	constructor(private readonly config: QuickConnectConfig) {}

	getConfiguredQuickConnectOptions() {
		return this.config.options;
	}
}
