import { createTestingPinia } from '@pinia/testing';
import { createComponentRenderer } from '@/__tests__/render';
import { cleanup, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { createEventBus } from '@n8n/utils/event-bus';
import WorkflowHistoryVersionFormModal, {
	type WorkflowHistoryVersionFormModalEventBusEvents,
} from './WorkflowHistoryVersionFormModal.vue';
import { STORES } from '@n8n/stores';

const TEST_MODAL_KEY = 'test-modal';

const renderComponent = createComponentRenderer(WorkflowHistoryVersionFormModal, {
	pinia: createTestingPinia({
		initialState: {
			[STORES.UI]: {
				modalsById: {
					[TEST_MODAL_KEY]: {
						open: true,
					},
				},
				modalStack: [TEST_MODAL_KEY],
			},
		},
	}),
	global: {
		stubs: {
			Modal: {
				template: '<div><slot name="header" /><slot name="content" /><slot name="footer" /></div>',
				props: ['name', 'eventBus'],
				mounted() {
					this.eventBus?.emit('opened');
				},
			},
			WorkflowVersionForm: {
				template: `
					<div>
						<input :data-test-id="versionNameTestId" :value="versionName" @input="$emit('update:versionName', $event.target.value)" />
						<textarea :data-test-id="descriptionTestId" :value="description" @input="$emit('update:description', $event.target.value)" />
					</div>
				`,
				props: ['versionName', 'description', 'versionNameTestId', 'descriptionTestId'],
				methods: {
					focusInput: vi.fn(),
				},
			},
		},
	},
});

describe('WorkflowHistoryVersionFormModal', () => {
	afterEach(() => {
		cleanup();
	});

	it('should generate version name from versionId if not provided', async () => {
		const eventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();
		const { getByTestId } = renderComponent({
			props: {
				modalName: TEST_MODAL_KEY,
				modalTitle: 'Test Modal',
				submitButtonLabel: 'Submit',
				data: {
					versionId: '12345678abcd',
					workflowId: 'workflow-1',
					formattedCreatedAt: '2024-01-01',
					eventBus,
				},
			},
		});

		await waitFor(() => {
			const input = getByTestId(`${TEST_MODAL_KEY}-version-name-input`);
			expect(input).toHaveValue('Version 12345678');
		});
	});

	it('should use provided versionName if available', async () => {
		const eventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();
		const { getByTestId } = renderComponent({
			props: {
				modalName: TEST_MODAL_KEY,
				modalTitle: 'Test Modal',
				submitButtonLabel: 'Submit',
				data: {
					versionId: '12345678abcd',
					workflowId: 'workflow-1',
					formattedCreatedAt: '2024-01-01',
					versionName: 'Custom Version Name',
					eventBus,
				},
			},
		});

		await waitFor(() => {
			const input = getByTestId(`${TEST_MODAL_KEY}-version-name-input`);
			expect(input).toHaveValue('Custom Version Name');
		});
	});

	it('should use provided description if available', async () => {
		const eventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();
		const { getByTestId } = renderComponent({
			props: {
				modalName: TEST_MODAL_KEY,
				modalTitle: 'Test Modal',
				submitButtonLabel: 'Submit',
				data: {
					versionId: '12345678abcd',
					workflowId: 'workflow-1',
					formattedCreatedAt: '2024-01-01',
					description: 'Custom description',
					eventBus,
				},
			},
		});

		await waitFor(() => {
			const textarea = getByTestId(`${TEST_MODAL_KEY}-description-input`);
			expect(textarea).toHaveValue('Custom description');
		});
	});

	it('should emit submit event with correct data when submit button is clicked', async () => {
		const eventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();
		const submitHandler = vi.fn();
		eventBus.on('submit', submitHandler);

		const { getByTestId } = renderComponent({
			props: {
				modalName: TEST_MODAL_KEY,
				modalTitle: 'Test Modal',
				submitButtonLabel: 'Submit',
				data: {
					versionId: 'version-123',
					workflowId: 'workflow-1',
					formattedCreatedAt: '2024-01-01',
					versionName: 'Test Version',
					description: 'Test Description',
					eventBus,
				},
			},
		});

		await waitFor(async () => {
			const submitButton = getByTestId(`${TEST_MODAL_KEY}-submit-button`);
			await userEvent.click(submitButton);
		});

		expect(submitHandler).toHaveBeenCalledWith({
			versionId: 'version-123',
			name: 'Test Version',
			description: 'Test Description',
		});
	});

	it('should emit cancel event when cancel button is clicked', async () => {
		const eventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();
		const cancelHandler = vi.fn();
		eventBus.on('cancel', cancelHandler);

		const { getByTestId } = renderComponent({
			props: {
				modalName: TEST_MODAL_KEY,
				modalTitle: 'Test Modal',
				submitButtonLabel: 'Submit',
				data: {
					versionId: 'version-123',
					workflowId: 'workflow-1',
					formattedCreatedAt: '2024-01-01',
					eventBus,
				},
			},
		});

		await waitFor(async () => {
			const cancelButton = getByTestId(`${TEST_MODAL_KEY}-cancel-button`);
			await userEvent.click(cancelButton);

			expect(cancelHandler).toHaveBeenCalled();
		});
	});

	it('should disable submit button when version name is empty', async () => {
		const eventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();
		const { getByTestId } = renderComponent({
			props: {
				modalName: TEST_MODAL_KEY,
				modalTitle: 'Test Modal',
				submitButtonLabel: 'Submit',
				data: {
					versionId: 'version-123',
					workflowId: 'workflow-1',
					formattedCreatedAt: '2024-01-01',
					versionName: '',
					eventBus,
				},
			},
		});

		await waitFor(() => {
			const submitButton = getByTestId(`${TEST_MODAL_KEY}-submit-button`);
			expect(submitButton).toBeDisabled();
		});
	});

	it('should disable submit button when version name is only whitespace', async () => {
		const eventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();
		const { getByTestId } = renderComponent({
			props: {
				modalName: TEST_MODAL_KEY,
				modalTitle: 'Test Modal',
				submitButtonLabel: 'Submit',
				data: {
					versionId: 'version-123',
					workflowId: 'workflow-1',
					formattedCreatedAt: '2024-01-01',
					versionName: '   ',
					eventBus,
				},
			},
		});

		await waitFor(() => {
			const submitButton = getByTestId(`${TEST_MODAL_KEY}-submit-button`);
			expect(submitButton).toBeDisabled();
		});
	});

	it('should not submit when version name is empty', async () => {
		const eventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();
		const submitHandler = vi.fn();
		eventBus.on('submit', submitHandler);

		const { getByTestId } = renderComponent({
			props: {
				modalName: TEST_MODAL_KEY,
				modalTitle: 'Test Modal',
				submitButtonLabel: 'Submit',
				data: {
					versionId: 'version-123',
					workflowId: 'workflow-1',
					formattedCreatedAt: '2024-01-01',
					versionName: '',
					eventBus,
				},
			},
		});

		await waitFor(async () => {
			const nameInput = getByTestId(`${TEST_MODAL_KEY}-version-name-input`);
			await userEvent.clear(nameInput);

			const submitButton = getByTestId(`${TEST_MODAL_KEY}-submit-button`);
			expect(submitButton).toBeDisabled();
		});

		expect(submitHandler).not.toHaveBeenCalled();
	});
});
