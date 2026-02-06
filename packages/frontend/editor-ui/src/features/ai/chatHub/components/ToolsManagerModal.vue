<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid';
import Modal from '@/app/components/Modal.vue';
import { useNodeTypesStore } from '@/app/stores/nodeTypes.store';
import { useUIStore } from '@/app/stores/ui.store';
import { TOOL_SETTINGS_MODAL_KEY } from '@/features/ai/chatHub/constants';
import ToolListItem from './ToolListItem.vue';
import { N8nButton, N8nHeading, N8nIcon, N8nInput, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { createEventBus } from '@n8n/utils/event-bus';
import { useDebounceFn } from '@vueuse/core';
import { NodeConnectionTypes, type INode, type INodeTypeDescription } from 'n8n-workflow';
import { computed, ref, shallowRef, watch } from 'vue';
import { DEBOUNCE_TIME, getDebounceTime } from '@/app/constants';

const props = defineProps<{
	modalName: string;
	data: {
		tools: INode[];
		onConfirm: (tools: INode[]) => void;
	};
}>();

const i18n = useI18n();
const nodeTypesStore = useNodeTypesStore();
const uiStore = useUIStore();

const modalBus = ref(createEventBus());
const searchQuery = ref('');
const debouncedSearchQuery = ref('');

const tools = shallowRef<INode[]>([]);
const enabledToolIds = ref<Set<string>>(new Set());

const setDebouncedSearchQuery = useDebounceFn((value: string) => {
	debouncedSearchQuery.value = value;
}, getDebounceTime(DEBOUNCE_TIME.INPUT.SEARCH));

watch(searchQuery, (newValue) => {
	void setDebouncedSearchQuery(newValue);
});

watch(
	() => props.data.tools,
	(initialTools) => {
		tools.value = [...initialTools];
		enabledToolIds.value = new Set(initialTools.map((t) => t.id));
	},
	{ immediate: true },
);

const availableToolTypes = computed<INodeTypeDescription[]>(() => {
	const toolTypeNames =
		nodeTypesStore.visibleNodeTypesByOutputConnectionTypeNames[NodeConnectionTypes.AiTool] ?? [];

	return toolTypeNames
		.map((name) => nodeTypesStore.getNodeType(name))
		.filter((nodeType): nodeType is INodeTypeDescription => nodeType !== null);
});

const filteredConfiguredTools = computed(() => {
	if (!debouncedSearchQuery.value) {
		return tools.value;
	}
	const query = debouncedSearchQuery.value.toLowerCase();
	return tools.value.filter((tool) => {
		const nodeType = nodeTypesStore.getNodeType(tool.type, tool.typeVersion);
		const nameMatch = tool.name.toLowerCase().includes(query);
		const typeMatch = nodeType?.displayName.toLowerCase().includes(query);
		return nameMatch || typeMatch;
	});
});

const filteredAvailableTools = computed(() => {
	if (!debouncedSearchQuery.value) {
		return availableToolTypes.value;
	}
	const query = debouncedSearchQuery.value.toLowerCase();
	return availableToolTypes.value.filter((nodeType) => {
		const nameMatch = nodeType.displayName.toLowerCase().includes(query);
		const descMatch = nodeType.description?.toLowerCase().includes(query);
		return nameMatch || descMatch;
	});
});

function getNodeType(tool: INode): INodeTypeDescription | null {
	return nodeTypesStore.getNodeType(tool.type, tool.typeVersion);
}

function handleToggleTool(toolId: string, enabled: boolean) {
	const newSet = new Set(enabledToolIds.value);
	if (enabled) {
		newSet.add(toolId);
	} else {
		newSet.delete(toolId);
	}
	enabledToolIds.value = newSet;
}

function handleConfigureTool(tool: INode) {
	const otherToolNames = tools.value.filter((t) => t.id !== tool.id).map((t) => t.name);

	uiStore.openModalWithData({
		name: TOOL_SETTINGS_MODAL_KEY,
		data: {
			node: { ...tool },
			existingToolNames: otherToolNames,
			onConfirm: (configuredNode: INode) => {
				tools.value = tools.value.map((t) => (t.id === tool.id ? configuredNode : t));
			},
		},
	});
}

function handleRemoveTool(toolId: string) {
	tools.value = tools.value.filter((t) => t.id !== toolId);
	enabledToolIds.value.delete(toolId);
}

function handleAddTool(nodeType: INodeTypeDescription) {
	const typeVersion =
		typeof nodeType.version === 'number'
			? nodeType.version
			: nodeType.version.toSorted((a, b) => b - a)?.[0];

	if (!typeVersion) {
		return;
	}

	const newToolId = uuidv4();
	const existingNames = tools.value.map((t) => t.name);

	uiStore.openModalWithData({
		name: TOOL_SETTINGS_MODAL_KEY,
		data: {
			node: {
				type: nodeType.name,
				typeVersion,
				parameters: {},
				id: newToolId,
				name: nodeType.displayName,
				position: [0, 0],
			},
			existingToolNames: existingNames,
			onConfirm: (configuredNode: INode) => {
				tools.value = [...tools.value, configuredNode];
				enabledToolIds.value.add(configuredNode.id);
			},
		},
	});
}

function handleConfirm() {
	const enabledTools = tools.value.filter((t) => enabledToolIds.value.has(t.id));
	props.data.onConfirm(enabledTools);
	modalBus.value.emit('close');
}

function handleCancel() {
	modalBus.value.emit('close');
}
</script>

<template>
	<Modal
		:name="modalName"
		:event-bus="modalBus"
		width="560px"
		:center="true"
		max-width="90vw"
		max-height="80vh"
		:scrollable="true"
		:class="$style.modal"
	>
		<template #header>
			<N8nHeading tag="h2" size="large">
				{{ i18n.baseText('chatHub.toolsManager.title') }}
			</N8nHeading>
		</template>

		<template #content>
			<div :class="$style.content">
				<N8nInput
					v-model="searchQuery"
					:placeholder="i18n.baseText('chatHub.toolsManager.searchPlaceholder')"
					clearable
					:class="$style.searchInput"
				>
					<template #prefix>
						<N8nIcon icon="search" />
					</template>
				</N8nInput>

				<div v-if="filteredConfiguredTools.length > 0" :class="$style.section">
					<N8nText :class="$style.sectionTitle" size="small" color="text-light" tag="h3">
						{{ i18n.baseText('chatHub.toolsManager.configuredTools') }}
					</N8nText>
					<div :class="$style.toolsList">
						<ToolListItem
							v-for="tool in filteredConfiguredTools"
							:key="tool.id"
							:node-type="getNodeType(tool)!"
							:configured-node="tool"
							:enabled="enabledToolIds.has(tool.id)"
							mode="configured"
							@toggle="(enabled) => handleToggleTool(tool.id, enabled)"
							@configure="handleConfigureTool(tool)"
							@remove="handleRemoveTool(tool.id)"
						/>
					</div>
				</div>

				<div v-if="filteredAvailableTools.length > 0" :class="$style.section">
					<N8nText :class="$style.sectionTitle" size="small" color="text-light" tag="h3">
						{{ i18n.baseText('chatHub.toolsManager.availableTools') }}
					</N8nText>
					<div :class="$style.toolsList">
						<ToolListItem
							v-for="nodeType in filteredAvailableTools"
							:key="nodeType.name"
							:node-type="nodeType"
							mode="available"
							@add="handleAddTool(nodeType)"
						/>
					</div>
				</div>

				<div
					v-if="filteredConfiguredTools.length === 0 && filteredAvailableTools.length === 0"
					:class="$style.emptyState"
				>
					<N8nText color="text-light">
						{{ i18n.baseText('chatHub.toolsManager.noResults') }}
					</N8nText>
				</div>
			</div>
		</template>

		<template #footer>
			<div :class="$style.footer">
				<N8nButton type="tertiary" @click="handleCancel">
					{{ i18n.baseText('chatHub.toolsManager.cancel') }}
				</N8nButton>
				<N8nButton type="primary" @click="handleConfirm">
					{{ i18n.baseText('chatHub.toolsManager.confirm') }}
				</N8nButton>
			</div>
		</template>
	</Modal>
</template>

<style lang="scss" module>
.modal {
	:global(.el-dialog__body) {
		padding: 0;
	}
}

.content {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: var(--spacing--sm);
}

.searchInput {
	width: 100%;
}

.section {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
}

.sectionTitle {
	text-transform: uppercase;
	font-weight: var(--font-weight--bold);
	letter-spacing: 0.5px;
	padding-left: var(--spacing--xs);
}

.toolsList {
	display: flex;
	flex-direction: column;
}

.emptyState {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--spacing--xl);
}

.footer {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	gap: var(--spacing--2xs);
	width: 100%;
	padding: var(--spacing--sm);
}
</style>
