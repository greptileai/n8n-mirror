import { Get, RestController } from '@n8n/decorators';

import { QuickConnectService } from './quick-connect.service';

@RestController('/quick-connect')
export class QuickConnectController {
	constructor(private readonly quickConnectService: QuickConnectService) {}

	@Get('/')
	getQuickConnectOptions() {
		return this.quickConnectService.getConfiguredQuickConnectOptions();
	}
}
