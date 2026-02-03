describe('Secret Providers Types API', () => {
	describe('Feature Flag', () => {
		it('should return 400 when externalSecretsForProjects feature is disabled');
	});

	describe('GET /secret-providers/types', () => {
		describe('Authorization', () => {
			it('should authorize owner to list provider types');
			it('should authorize global admin to list provider types');
			it('should refuse member to list provider types');
		});

		describe('with providers', () => {
			beforeAll(async () => {
				// call the endpoint
			});

			it('should return all available provider types when providers exist');
			it('should return multiple provider types when multiple are registered');
			it(
				'should return correct structure with type, displayName, icon, and properties for each provider',
			);
		});

		describe('without providers', () => {
			it('should return empty array when no providers are registered');
		});
	});

	describe('GET /secret-providers/types/:type', () => {
		describe('Authorization', () => {
			it('should authorize owner to get specific provider type');
			it('should authorize global admin to get specific provider type');
			it('should refuse member to get provider type');
		});

		describe('with provider', () => {
			beforeAll(async () => {
				// call the endpoint
			});

			it('should return provider type details for valid existing type');
			it('should return correct structure with type, displayName, icon, and properties');
			it('should return provider-specific properties matching the provider');
		});

		describe('without provider', () => {
			beforeAll(async () => {
				// call the endpoint
			});

			it('should return 404 for non-existent provider type');
			it('should return 404 with appropriate error message');
		});
	});
});
