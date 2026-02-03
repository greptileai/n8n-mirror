import type { ModuleInterface } from '@n8n/decorators';
import { BackendModule, OnShutdown } from '@n8n/decorators';

@BackendModule({ name: 'quick-connect' })
export class QuickConnectModule implements ModuleInterface {
	async init() {
		await import('./quick-connect.controller');
	}

	@OnShutdown()
	async shutdown() {}
}
