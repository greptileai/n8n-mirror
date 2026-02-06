<script setup lang="ts">
import NodeIcon from '@/app/components/NodeIcon.vue';
import {
	N8nActionDropdown,
	N8nButton,
	N8nIconButton,
	N8nText,
	N8nTooltip,
} from '@n8n/design-system';
import { ElSwitch } from 'element-plus';
import type { ActionDropdownItem } from '@n8n/design-system/types';
import { useI18n } from '@n8n/i18n';
import type { INode, INodeTypeDescription } from 'n8n-workflow';
import { computed } from 'vue';

const props = defineProps<{
	nodeType: INodeTypeDescription;
	configuredNode?: INode;
	enabled?: boolean;
	mode: 'configured' | 'available';
}>();

const emit = defineEmits<{
	toggle: [enabled: boolean];
	configure: [];
	remove: [];
	add: [];
}>();

const i18n = useI18n();

const description = computed(() => {
	if (props.configuredNode && props.configuredNode.name !== props.nodeType.displayName) {
		return props.nodeType.displayName;
	}
	return props.nodeType.description;
});

const displayName = computed(() => {
	if (props.configuredNode) {
		return props.configuredNode.name;
	}
	return props.nodeType.displayName;
});

const menuItems = computed<Array<ActionDropdownItem<string>>>(() => [
	{
		id: 'remove',
		label: i18n.baseText('chatHub.toolsManager.remove'),
		icon: 'trash-2',
	},
]);

function handleMenuSelect(action: string) {
	if (action === 'remove') {
		emit('remove');
	}
}
</script>

<template>
	<div :class="[$style.item, { [$style.configured]: mode === 'configured' }]">
		<div :class="$style.iconWrapper">
			<NodeIcon :node-type="nodeType" :size="24" />
		</div>

		<div :class="$style.content">
			<N8nText :class="$style.name" size="small" color="text-dark">
				{{ displayName }}
			</N8nText>
			<N8nText :class="$style.description" size="small" color="text-light">
				{{ description }}
			</N8nText>
		</div>

		<div :class="$style.actions">
			<template v-if="mode === 'configured'">
				<N8nTooltip :content="i18n.baseText('chatHub.toolsManager.configure')">
					<N8nIconButton
						icon="settings"
						type="tertiary"
						text
						:class="$style.actionButton"
						@click="emit('configure')"
					/>
				</N8nTooltip>

				<N8nActionDropdown
					:items="menuItems"
					placement="bottom-end"
					@select="handleMenuSelect"
					@click.stop
				>
					<template #activator>
						<N8nIconButton
							icon="ellipsis-vertical"
							type="tertiary"
							text
							:class="$style.actionButton"
						/>
					</template>
				</N8nActionDropdown>

				<N8nTooltip
					:content="
						enabled
							? i18n.baseText('chatHub.toolsManager.disableTool')
							: i18n.baseText('chatHub.toolsManager.enableTool')
					"
				>
					<ElSwitch
						:model-value="enabled"
						:class="$style.toggle"
						@update:model-value="emit('toggle', Boolean($event))"
					/>
				</N8nTooltip>
			</template>

			<template v-else>
				<N8nButton type="tertiary" size="small" icon="plus" @click="emit('add')">
					{{ i18n.baseText('chatHub.toolsManager.add') }}
				</N8nButton>
			</template>
		</div>
	</div>
</template>

<style lang="scss" module>
.item {
	display: flex;
	align-items: center;
	gap: var(--spacing--xs);
	padding: var(--spacing--2xs) var(--spacing--xs);
	border-radius: var(--radius--lg);

	&:hover {
		background-color: var(--color--background--light-2);
	}

	&.configured {
		.actionButton {
			opacity: 0;
		}

		&:hover,
		&:has([aria-expanded='true']) {
			.actionButton {
				opacity: 1;
			}
		}
	}
}

.iconWrapper {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--5xs);
}

.name {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: var(--line-height--md);
}

.description {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: var(--line-height--md);
}

.actions {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	flex-shrink: 0;
}

.actionButton {
	box-shadow: none !important;
	outline: none !important;
}

.toggle {
	margin-left: var(--spacing--2xs);
}
</style>
