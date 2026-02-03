import { mockInstance } from '@n8n/backend-test-utils';
import { SettingsRepository } from '@n8n/db';
import {
	PERSONAL_SPACE_PUBLISHING_SETTING,
	PERSONAL_SPACE_SHARING_SETTING,
} from '@n8n/permissions';

import { RoleService } from '@/services/role.service';
import { SecuritySettingsService } from '@/services/security-settings.service';

describe('SecuritySettingsService', () => {
	const settingsRepository = mockInstance(SettingsRepository);
	const roleService = mockInstance(RoleService);
	const securitySettingsService = new SecuritySettingsService(settingsRepository, roleService);

	const PERSONAL_OWNER_ROLE_SLUG = 'project:personalOwner';

	beforeEach(() => {
		jest.restoreAllMocks();
	});

	describe('setPersonalSpacePublishing', () => {
		test('should upsert setting with true and add workflow:publish scope when enabled', async () => {
			await securitySettingsService.setPersonalSpaceSetting(
				PERSONAL_SPACE_PUBLISHING_SETTING,
				true,
			);

			expect(settingsRepository.upsert).toHaveBeenCalledWith(
				{
					key: PERSONAL_SPACE_PUBLISHING_SETTING.key,
					value: 'true',
					loadOnStartup: true,
				},
				['key'],
			);
			expect(roleService.addScopesToRole).toHaveBeenCalledWith(
				PERSONAL_OWNER_ROLE_SLUG,
				PERSONAL_SPACE_PUBLISHING_SETTING.scopes,
			);
			expect(roleService.removeScopesFromRole).not.toHaveBeenCalled();
		});

		test('should upsert setting with false and remove workflow:publish scope when disabled', async () => {
			await securitySettingsService.setPersonalSpaceSetting(
				PERSONAL_SPACE_PUBLISHING_SETTING,
				false,
			);

			expect(settingsRepository.upsert).toHaveBeenCalledWith(
				{
					key: PERSONAL_SPACE_PUBLISHING_SETTING.key,
					value: 'false',
					loadOnStartup: true,
				},
				['key'],
			);
			expect(roleService.removeScopesFromRole).toHaveBeenCalledWith(
				PERSONAL_OWNER_ROLE_SLUG,
				PERSONAL_SPACE_PUBLISHING_SETTING.scopes,
			);
			expect(roleService.addScopesToRole).not.toHaveBeenCalled();
		});
	});

	describe('isPersonalSpacePublishingEnabled', () => {
		test('should return true when setting does not exist (backward compatibility) with original behaviour', async () => {
			settingsRepository.findByKey.mockResolvedValue(null);

			const result = await securitySettingsService.isPersonalSpaceSettingEnabled(
				PERSONAL_SPACE_PUBLISHING_SETTING,
			);

			expect(settingsRepository.findByKey).toHaveBeenCalledWith(
				PERSONAL_SPACE_PUBLISHING_SETTING.key,
			);
			expect(result).toBe(true);
		});

		test('should return true when setting value is "true"', async () => {
			settingsRepository.findByKey.mockResolvedValue({
				key: PERSONAL_SPACE_PUBLISHING_SETTING.key,
				value: 'true',
			} as never);

			const result = await securitySettingsService.isPersonalSpaceSettingEnabled(
				PERSONAL_SPACE_PUBLISHING_SETTING,
			);

			expect(result).toBe(true);
		});

		test.each([
			{ value: 'false', description: '"false"' },
			{ value: 'invalid', description: 'an invalid string' },
			{ value: '', description: 'an empty string' },
		])('should return false when setting value is $description', async ({ value }) => {
			settingsRepository.findByKey.mockResolvedValue({
				key: PERSONAL_SPACE_PUBLISHING_SETTING.key,
				value,
			} as never);

			const result = await securitySettingsService.isPersonalSpaceSettingEnabled(
				PERSONAL_SPACE_PUBLISHING_SETTING,
			);

			expect(result).toBe(false);
		});
	});

	describe('setPersonalSpaceSharing', () => {
		test('should upsert setting with true and add sharing scopes when enabled', async () => {
			await securitySettingsService.setPersonalSpaceSetting(PERSONAL_SPACE_SHARING_SETTING, true);

			expect(settingsRepository.upsert).toHaveBeenCalledWith(
				{
					key: PERSONAL_SPACE_SHARING_SETTING.key,
					value: 'true',
					loadOnStartup: true,
				},
				['key'],
			);
			expect(roleService.addScopesToRole).toHaveBeenCalledWith(
				PERSONAL_OWNER_ROLE_SLUG,
				PERSONAL_SPACE_SHARING_SETTING.scopes,
			);
			expect(roleService.removeScopesFromRole).not.toHaveBeenCalled();
		});

		test('should upsert setting with false and remove sharing scopes when disabled', async () => {
			await securitySettingsService.setPersonalSpaceSetting(PERSONAL_SPACE_SHARING_SETTING, false);

			expect(settingsRepository.upsert).toHaveBeenCalledWith(
				{
					key: PERSONAL_SPACE_SHARING_SETTING.key,
					value: 'false',
					loadOnStartup: true,
				},
				['key'],
			);
			expect(roleService.removeScopesFromRole).toHaveBeenCalledWith(
				PERSONAL_OWNER_ROLE_SLUG,
				PERSONAL_SPACE_SHARING_SETTING.scopes,
			);
			expect(roleService.addScopesToRole).not.toHaveBeenCalled();
		});
	});

	describe('isPersonalSpaceSharingEnabled', () => {
		test('should return true when setting does not exist (backward compatibility)', async () => {
			settingsRepository.findByKey.mockResolvedValue(null);

			const result = await securitySettingsService.isPersonalSpaceSettingEnabled(
				PERSONAL_SPACE_SHARING_SETTING,
			);

			expect(settingsRepository.findByKey).toHaveBeenCalledWith(PERSONAL_SPACE_SHARING_SETTING.key);
			expect(result).toBe(true);
		});

		test('should return true when setting value is "true"', async () => {
			settingsRepository.findByKey.mockResolvedValue({
				key: PERSONAL_SPACE_SHARING_SETTING.key,
				value: 'true',
			} as never);

			const result = await securitySettingsService.isPersonalSpaceSettingEnabled(
				PERSONAL_SPACE_SHARING_SETTING,
			);

			expect(result).toBe(true);
		});

		test.each([
			{ value: 'false', description: '"false"' },
			{ value: 'invalid', description: 'an invalid string' },
			{ value: '', description: 'an empty string' },
		])('should return false when setting value is $description', async ({ value }) => {
			settingsRepository.findByKey.mockResolvedValue({
				key: PERSONAL_SPACE_SHARING_SETTING.key,
				value,
			} as never);

			const result = await securitySettingsService.isPersonalSpaceSettingEnabled(
				PERSONAL_SPACE_SHARING_SETTING,
			);

			expect(result).toBe(false);
		});
	});
});
