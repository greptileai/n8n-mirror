import type { ChatDocCreateCommand, ChatDocEditCommand, ChatDocument } from '@n8n/api-types';
import type { ChatMessage } from './chat.types';

/**
 * Parse <command:doc-create> commands from message content
 */
export function parseDocCreateCommands(content: string): ChatDocCreateCommand[] {
	const commands: ChatDocCreateCommand[] = [];
	const regex = /<command:doc-create>([\s\S]*?)<\/command:doc-create>/g;
	let match;

	while ((match = regex.exec(content)) !== null) {
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
 */
export function parseDocEditCommands(content: string): ChatDocEditCommand[] {
	const commands: ChatDocEditCommand[] = [];
	const regex = /<command:doc-edit>([\s\S]*?)<\/command:doc-edit>/g;
	let match;

	while ((match = regex.exec(content)) !== null) {
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
 * Parse incomplete/streaming <command:doc-create> command
 * Returns partial document even without closing tags for streaming support
 */
export function parsePartialDocCreate(content: string): {
	document: ChatDocCreateCommand | null;
	hasIncompleteCommand: boolean;
} {
	// Check if there's an opening tag but no closing tag (streaming in progress)
	const hasOpenTag = content.includes('<command:doc-create>');
	const hasCloseTag = content.includes('</command:doc-create>');

	if (!hasOpenTag) {
		return { document: null, hasIncompleteCommand: false };
	}

	// If complete, use the regular parser
	if (hasCloseTag) {
		const commands = parseDocCreateCommands(content);
		return { document: commands[commands.length - 1] ?? null, hasIncompleteCommand: false };
	}

	// Parse partial/streaming content
	const startIndex = content.lastIndexOf('<command:doc-create>');
	const partialContent = content.substring(startIndex);

	const titleMatch = /<title>([\s\S]*?)(?:<\/title>|$)/.exec(partialContent);
	const typeMatch = /<type>([\s\S]*?)(?:<\/type>|$)/.exec(partialContent);
	const contentMatch = /<content>([\s\S]*?)(?:<\/content>|$)/.exec(partialContent);

	// Need at least title and type to start rendering
	if (!titleMatch || !typeMatch) {
		return { document: null, hasIncompleteCommand: false };
	}

	return {
		document: {
			title: titleMatch[1].trim(),
			type: typeMatch[1].trim(),
			content: contentMatch ? contentMatch[1] : '',
		},
		hasIncompleteCommand: true,
	};
}

/**
 * Strip all document command tags from content
 * Handles both complete commands and partial/streaming commands
 */
export function stripDocumentCommands(content: string): string {
	// First strip complete commands
	let result = content
		.replace(/<command:doc-create>[\s\S]*?<\/command:doc-create>/g, '')
		.replace(/<command:doc-edit>[\s\S]*?<\/command:doc-edit>/g, '');

	// Strip incomplete streaming commands (with complete opening tag)
	result = result.replace(/<command:doc-create>[\s\S]*$/g, '');
	result = result.replace(/<command:doc-edit>[\s\S]*$/g, '');

	// Strip any trailing incomplete opening tag during streaming
	// This prevents flickering when tags arrive character by character
	// e.g., "<com", "<command:", "<command:doc-c", etc.
	// We only check for "<com" or longer to avoid stripping legitimate content like "a < b"
	const lastOpenBracket = result.lastIndexOf('<');
	if (lastOpenBracket !== -1) {
		const afterBracket = result.substring(lastOpenBracket);
		// Check if it's an incomplete tag (no closing >) that looks like a command prefix
		if (
			!afterBracket.includes('>') &&
			afterBracket.length >= 4 && // At least "<com"
			('<command:doc-create>'.startsWith(afterBracket) ||
				'<command:doc-edit>'.startsWith(afterBracket))
		) {
			result = result.substring(0, lastOpenBracket);
		}
	}

	return result.trim();
}

/**
 * Reconstruct the current document state from message history
 * Supports streaming by parsing partial commands in the last message
 */
export function reconstructDocument(messages: ChatMessage[]): {
	document: ChatDocument | null;
	hasIncompleteCommand: boolean;
} {
	let doc: ChatDocument | null = null;

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		const isLastMessage = i === messages.length - 1;

		// For the last message, check for partial/streaming commands
		if (isLastMessage) {
			const partialCreate = parsePartialDocCreate(message.content);
			if (partialCreate.document) {
				return partialCreate;
			}
		}

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

	return { document: doc, hasIncompleteCommand: false };
}
