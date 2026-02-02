import type { ChatDocEditCommand, ChatDocument } from '@n8n/api-types';
import type { ChatHubMessage } from './chat-hub-message.entity';
import type { ChatDocCreateCommand } from '@n8n/api-types/src';

/**
 * Parse <command:doc-create> commands from message content
 * Handles commands that may be wrapped in code fences
 */
function parseDocCreateCommands(content: string): ChatDocCreateCommand[] {
	const commands: ChatDocCreateCommand[] = [];
	// Strip code fences that might wrap commands (in case model ignores instructions)
	const cleanedContent = content
		.replace(/```[\s\S]*?<command:doc-create>/g, '<command:doc-create>')
		.replace(/<\/command:doc-create>[\s\S]*?```/g, '</command:doc-create>');

	const regex = /<command:doc-create>([\s\S]*?)<\/command:doc-create>/g;
	let match;

	while ((match = regex.exec(cleanedContent)) !== null) {
		const innerContent = match[1];
		const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(innerContent);
		const typeMatch = /<type>([\s\S]*?)<\/type>/.exec(innerContent);
		const contentMatch = /<content>([\s\S]*?)<\/content>/.exec(innerContent);

		if (titleMatch && typeMatch && contentMatch) {
			commands.push({
				title: titleMatch[1].trim(),
				type: typeMatch[1].trim(),
				content: contentMatch[1],
			});
		}
	}

	return commands;
}

/**
 * Parse <command:doc-edit> commands from message content
 * Handles commands that may be wrapped in code fences
 */
function parseDocEditCommands(content: string): ChatDocEditCommand[] {
	const commands: ChatDocEditCommand[] = [];
	// Strip code fences that might wrap commands
	const cleanedContent = content
		.replace(/```[\s\S]*?<command:doc-edit>/g, '<command:doc-edit>')
		.replace(/<\/command:doc-edit>[\s\S]*?```/g, '</command:doc-edit>');

	const regex = /<command:doc-edit>([\s\S]*?)<\/command:doc-edit>/g;
	let match;

	while ((match = regex.exec(cleanedContent)) !== null) {
		const innerContent = match[1];
		const oldStringMatch = /<oldString>([\s\S]*?)<\/oldString>/.exec(innerContent);
		const newStringMatch = /<newString>([\s\S]*?)<\/newString>/.exec(innerContent);
		const replaceAllMatch = /<replaceAll>([\s\S]*?)<\/replaceAll>/.exec(innerContent);

		if (oldStringMatch && newStringMatch) {
			commands.push({
				oldString: oldStringMatch[1],
				newString: newStringMatch[1],
				replaceAll: replaceAllMatch ? replaceAllMatch[1].trim() === 'true' : false,
			});
		}
	}

	return commands;
}

/**
 * Reconstruct the current document state from message history
 * Supports streaming by parsing partial commands in the last message
 * Returns document and a flag indicating if there's an incomplete command
 */
export function reconstructDocument(messages: ChatHubMessage[]): ChatDocument | null {
	let doc: ChatDocument | null = null;

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];

		// Parse complete commands
		const createCommands = parseDocCreateCommands(message.content);
		const editCommands = parseDocEditCommands(message.content);

		for (const cmd of createCommands) {
			doc = { title: cmd.title, type: cmd.type, content: cmd.content };
		}

		for (const cmd of editCommands) {
			if (doc) {
				if (cmd.replaceAll) {
					doc.content = doc.content.split(cmd.oldString).join(cmd.newString);
				} else {
					doc.content = doc.content.replace(cmd.oldString, cmd.newString);
				}
			}
		}
	}

	return doc;
}
