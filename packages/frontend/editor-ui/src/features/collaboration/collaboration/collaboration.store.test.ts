import { setActivePinia, createPinia } from 'pinia';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useCollaborationStore } from './collaboration.store';

const mockPushStore = {
	send: vi.fn(),
	addEventListener: vi.fn().mockReturnValue(vi.fn()),
	clearQueue: vi.fn(),
};

const mockWorkflowId = ref('workflow-1');
const mockIsWorkflowSaved = ref<Record<string, boolean>>({
	'workflow-1': true,
	'workflow-2': true,
});

vi.mock('@/app/stores/pushConnection.store', () => ({
	usePushConnectionStore: () => mockPushStore,
}));

vi.mock('@/app/stores/workflows.store', () => ({
	useWorkflowsStore: () => ({
		get workflowId() {
			return mockWorkflowId.value;
		},
		get isWorkflowSaved() {
			return mockIsWorkflowSaved.value;
		},
	}),
}));

vi.mock('@/app/stores/workflowsList.store', () => ({
	useWorkflowsListStore: () => ({
		fetchWorkflow: vi.fn(),
	}),
}));

vi.mock('@/features/settings/users/users.store', () => ({
	useUsersStore: () => ({
		currentUserId: 'user-1',
	}),
}));

vi.mock('@/app/stores/ui.store', () => ({
	useUIStore: () => ({
		stateIsDirty: false,
	}),
}));

vi.mock('@n8n/stores/useRootStore', () => ({
	useRootStore: () => ({
		restApiContext: {},
	}),
}));

vi.mock('@/features/ai/assistant/builder.store', () => ({
	useBuilderStore: () => ({
		streaming: false,
	}),
}));

vi.mock('@/app/api/workflows', () => ({
	getWorkflowWriteLock: vi.fn().mockResolvedValue({ userId: null }),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({}),
}));

vi.mock('@/app/composables/useBeforeUnload', () => ({
	useBeforeUnload: () => ({
		addBeforeUnloadEventBindings: vi.fn(),
		removeBeforeUnloadEventBindings: vi.fn(),
		addBeforeUnloadHandler: vi.fn(),
	}),
}));

describe('useCollaborationStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		mockWorkflowId.value = 'workflow-1';
		mockIsWorkflowSaved.value = { 'workflow-1': true, 'workflow-2': true };
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('workflowId change handling', () => {
		test('should not send release message when collaboratingWorkflowId is null', () => {
			const store = useCollaborationStore();

			// Don't initialize - collaboratingWorkflowId remains null
			store.releaseWriteAccess();

			// Should not have sent the writeAccessReleaseRequested message
			const releaseCall = mockPushStore.send.mock.calls.find(
				(call) => (call[0] as { type: string }).type === 'writeAccessReleaseRequested',
			);
			expect(releaseCall).toBeUndefined();
		});

		test('should use stored collaboratingWorkflowId when notifying workflow closed', async () => {
			const store = useCollaborationStore();

			// Initialize collaboration on workflow-1
			await store.initialize();

			// Clear any calls from initialization
			mockPushStore.send.mockClear();

			// Change workflowId to workflow-2 (simulating navigation)
			mockWorkflowId.value = 'workflow-2';

			// Terminate - should use the stored collaboratingWorkflowId (workflow-1)
			store.terminate();

			expect(mockPushStore.send).toHaveBeenCalledWith({
				type: 'workflowClosed',
				workflowId: 'workflow-1',
			});
		});

		test('should terminate and reinitialize when switching between saved workflows via watcher', async () => {
			const store = useCollaborationStore();

			// Initialize collaboration on workflow-1
			await store.initialize();

			// Clear calls from initialization
			mockPushStore.send.mockClear();
			mockPushStore.addEventListener.mockClear();

			// Trigger the watcher by changing workflowId
			mockWorkflowId.value = 'workflow-2';

			// Wait for watcher to execute
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Should have sent workflowClosed for workflow-1
			expect(mockPushStore.send).toHaveBeenCalledWith({
				type: 'workflowClosed',
				workflowId: 'workflow-1',
			});

			// Should have sent workflowOpened for workflow-2
			expect(mockPushStore.send).toHaveBeenCalledWith({
				type: 'workflowOpened',
				workflowId: 'workflow-2',
			});
		});

		test('should only terminate when navigating to unsaved workflow', async () => {
			const store = useCollaborationStore();

			// Initialize collaboration on workflow-1
			await store.initialize();

			// Clear calls from initialization
			mockPushStore.send.mockClear();

			// Navigate to unsaved workflow (empty string)
			mockWorkflowId.value = '';

			// Wait for watcher to execute
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Should have sent workflowClosed for workflow-1
			expect(mockPushStore.send).toHaveBeenCalledWith({
				type: 'workflowClosed',
				workflowId: 'workflow-1',
			});

			// Should NOT have sent workflowOpened for the empty workflow
			const openedCall = mockPushStore.send.mock.calls.find(
				(call) => (call[0] as { type: string }).type === 'workflowOpened',
			);
			expect(openedCall).toBeUndefined();
		});
	});
});
