import { Config, Env } from '@n8n/config';
import { jsonParse } from 'n8n-workflow';
import { z } from 'zod';

const quickConnectOptionsSchema = z.string().pipe(
	z.preprocess(
		(input: string) => jsonParse(input),
		z
			.array(
				z.object({
					packageName: z.string(),
					credentialType: z.string(),
					text: z.string(),
					quickConnectType: z.string(),
				}),
			)
			.optional(),
	),
);

type QuickConnectOptions = z.infer<typeof quickConnectOptionsSchema>;

@Config
export class QuickConnectConfig {
	/** Promoted quick connect options */
	@Env('N8N_QUICK_CONNECT_OPTIONS', quickConnectOptionsSchema)
	options: QuickConnectOptions = [];
}
