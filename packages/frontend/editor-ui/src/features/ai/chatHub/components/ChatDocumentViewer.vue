<script setup lang="ts">
import type { ChatDocument } from '@n8n/api-types';
import { N8nIconButton, N8nSelect2 } from '@n8n/design-system';
import { computed } from 'vue';
import ChatMarkdownChunk from './ChatMarkdownChunk.vue';

const props = defineProps<{
	documents: ChatDocument[];
	selectedIndex: number;
}>();

const emit = defineEmits<{
	close: [];
	selectDocument: [title: number];
	download: [];
}>();

const selectedDocument = computed(() => props.documents[props.selectedIndex] ?? props.documents[0]);

const documentOptions = computed(() =>
	props.documents.map((doc, index) => ({
		value: index,
		label: doc.title,
	})),
);

const isHtmlDocument = computed(() => selectedDocument.value?.type === 'html');
const isMarkdownDocument = computed(() => selectedDocument.value?.type === 'md');
const markdownContent = computed(() => ({
	type: 'text' as const,
	content: isMarkdownDocument.value
		? selectedDocument.value?.content
		: `\`\`\`${selectedDocument.value?.type}\n${selectedDocument.value?.content}\n\`\`\``,
}));
</script>

<template>
	<div :class="$style.container">
		<div :class="$style.viewer">
			<div :class="$style.header">
				<N8nSelect2
					:model-value="selectedIndex"
					size="medium"
					variant="ghost"
					:items="documentOptions"
					@update:model-value="emit('selectDocument', $event)"
				/>
				<div :class="$style.headerActions">
					<N8nIconButton type="tertiary" text icon="download" @click="emit('download')" />
					<N8nIconButton type="tertiary" text icon="x" @click="emit('close')" />
				</div>
			</div>

			<div :class="$style.content">
				<iframe
					v-if="isHtmlDocument"
					:srcdoc="selectedDocument?.content"
					:class="$style.iframe"
					sandbox=""
					:title="selectedDocument?.title"
				/>

				<ChatMarkdownChunk
					v-else-if="markdownContent"
					ref="markdownChunk"
					:class="isMarkdownDocument ? $style.markdown : ''"
					:single-pre="!isMarkdownDocument"
					:source="markdownContent"
				/>
			</div>
		</div>
	</div>
</template>

<style lang="scss" module>
.container {
	height: 100%;
	width: 100%;
	display: flex;
	flex-direction: column;
	background-color: var(--color--background--light-2);
	border-left: var(--border-width) var(--border-style) var(--color--foreground);
	min-width: 0;
}

.viewer {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--4xs);
	padding-left: var(--spacing--4xs);
	padding-right: var(--spacing--xs);
	height: 56px;
	flex-grow: 0;
	flex-shrink: 0;
	border-bottom: var(--border);
	min-width: 0;
}

.markdown {
	padding-inline: var(--spacing--sm);
}

.title {
	flex-grow: 1;
	flex-shrink: 1;
	color: var(--color--text);
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.headerActions {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	flex-shrink: 0;
}

.type {
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.content {
	flex: 1;
	overflow-x: hidden;
}

.iframe {
	width: 100%;
	height: 100%;
	border: none;
	background-color: var(--color--background);
}
</style>
