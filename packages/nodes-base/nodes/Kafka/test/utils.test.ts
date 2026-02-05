import { getAutoCommitSettings, type KafkaTriggerOptions } from '../utils';

describe('Kafka Utils', () => {
	describe('getAutoCommitSettings', () => {
		it('should return autoCommit true and eachBatchAutoResolve false for version 1.1', () => {
			const options: KafkaTriggerOptions = {};
			const result = getAutoCommitSettings(options);

			expect(result).toEqual({
				autoCommit: true,
				eachBatchAutoResolve: false,
				autoCommitInterval: undefined,
				autoCommitThreshold: undefined,
			});
		});
	});
});
