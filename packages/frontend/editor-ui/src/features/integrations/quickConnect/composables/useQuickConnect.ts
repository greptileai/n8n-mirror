import { QUICK_CONNECT_EXPERIMENT } from '@/app/constants';
import { usePostHog } from '@/app/stores/posthog.store';
import { useSettingsStore } from '@/app/stores/settings.store';

type UseQuickConnectParams = {
	packageName?: string;
	credentialType?: string;
};

export function useQuickConnect({ credentialType, packageName }: UseQuickConnectParams) {
	const settingsStore = useSettingsStore();
	const posthogStore = usePostHog();
	const quickConnectEnabled = posthogStore.isVariantEnabled(
		QUICK_CONNECT_EXPERIMENT.name,
		QUICK_CONNECT_EXPERIMENT.variant,
	);
	if (quickConnectEnabled && settingsStore.moduleSettings['quick-connect']?.options.length) {
		const quickConnectOption = settingsStore.moduleSettings['quick-connect']?.options.find(
			(option) => option.credentialType === credentialType || option.packageName === packageName,
		);

		return quickConnectOption;
	}

	return;
}
