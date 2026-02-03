import type {
	ChatArtifactCreateCommand,
	ChatArtifactEditCommand,
	ChatArtifact,
	ChatHubMessageType,
} from '@n8n/api-types';

export interface MessageWithContent {
	type: ChatHubMessageType;
	id: string;
	content: string;
}

export type ParsedMessageItem =
	| { type: 'text'; content: string }
	| { type: 'artifact-create'; command: ChatArtifactCreateCommand }
	| { type: 'artifact-edit'; command: ChatArtifactEditCommand };

/**
 * Parse <command:artifact-create> commands from message content
 * Handles commands that may be wrapped in code fences
 */
function parseArtifactCreateCommands(content: string): ChatArtifactCreateCommand[] {
	const commands: ChatArtifactCreateCommand[] = [];
	// Strip code fences that might wrap commands (in case model ignores instructions)
	const cleanedContent = content
		.replace(/```[\s\S]*?<command:artifact-create>/g, '<command:artifact-create>')
		.replace(/<\/command:artifact-create>[\s\S]*?```/g, '</command:artifact-create>');

	const regex = /<command:artifact-create>([\s\S]*?)<\/command:artifact-create>/g;
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
				isIncomplete: false,
			});
		}
	}

	return commands;
}

/**
 * Parse <command:artifact-edit> commands from message content
 * Handles commands that may be wrapped in code fences
 */
function parseArtifactEditCommands(content: string): ChatArtifactEditCommand[] {
	const commands: ChatArtifactEditCommand[] = [];
	// Strip code fences that might wrap commands
	const cleanedContent = content
		.replace(/```[\s\S]*?<command:artifact-edit>/g, '<command:artifact-edit>')
		.replace(/<\/command:artifact-edit>[\s\S]*?```/g, '</command:artifact-edit>');

	const regex = /<command:artifact-edit>([\s\S]*?)<\/command:artifact-edit>/g;
	let match;

	while ((match = regex.exec(cleanedContent)) !== null) {
		const innerContent = match[1];
		const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(innerContent);
		const oldStringMatch = /<oldString>([\s\S]*?)<\/oldString>/.exec(innerContent);
		const newStringMatch = /<newString>([\s\S]*?)<\/newString>/.exec(innerContent);
		const replaceAllMatch = /<replaceAll>([\s\S]*?)<\/replaceAll>/.exec(innerContent);

		if (titleMatch && oldStringMatch && newStringMatch) {
			commands.push({
				title: titleMatch[1].trim(),
				oldString: oldStringMatch[1],
				newString: newStringMatch[1],
				replaceAll: replaceAllMatch ? replaceAllMatch[1].trim() === 'true' : false,
				isIncomplete: false,
			});
		}
	}

	return commands;
}

/**
 * Parse incomplete/streaming <command:artifact-create> command
 * Returns partial artifact even without closing tags for streaming support
 * Returns a minimal incomplete command even with just the opening tag to hide it during streaming
 */
function parsePartialArtifactCreate(content: string): ChatArtifactCreateCommand | null {
	// Check if there's an opening tag but no closing tag (streaming in progress)
	const hasOpenTag = content.includes('<command:artifact-create>');
	const hasCloseTag = content.includes('</command:artifact-create>');

	if (!hasOpenTag) {
		return null;
	}

	// If complete, use the regular parser
	if (hasCloseTag) {
		const commands = parseArtifactCreateCommands(content);
		return commands[commands.length - 1] ?? null;
	}

	// Parse partial/streaming content
	const startIndex = content.lastIndexOf('<command:artifact-create>');
	const partialContent = content.substring(startIndex);

	const titleMatch = /<title>([\s\S]*?)(?:<\/title>|$)/.exec(partialContent);
	const typeMatch = /<type>([\s\S]*?)(?:<\/type>|$)/.exec(partialContent);
	const contentMatch = /<content>([\s\S]*?)(?:<\/content>|$)/.exec(partialContent);

	// Return incomplete command with whatever we have so far
	// This hides the command during streaming until it's renderable
	return {
		title: titleMatch ? titleMatch[1].trim() : '',
		type: typeMatch ? typeMatch[1].trim() : '',
		content: contentMatch ? contentMatch[1] : '',
		isIncomplete: true,
	};
}

/**
 * Parse incomplete/streaming <command:artifact-edit> command
 * Returns partial edit command even without closing tags for streaming support
 * Returns a minimal incomplete command even with just the opening tag to hide it during streaming
 */
function parsePartialArtifactEdit(content: string): ChatArtifactEditCommand | null {
	// Check if there's an opening tag but no closing tag (streaming in progress)
	const hasOpenTag = content.includes('<command:artifact-edit>');
	const hasCloseTag = content.includes('</command:artifact-edit>');

	if (!hasOpenTag) {
		return null;
	}

	// If complete, use the regular parser
	if (hasCloseTag) {
		const commands = parseArtifactEditCommands(content);
		return commands[commands.length - 1] ?? null;
	}

	// Parse partial/streaming content
	const startIndex = content.lastIndexOf('<command:artifact-edit>');
	const partialContent = content.substring(startIndex);

	const titleMatch = /<title>([\s\S]*?)(?:<\/title>|$)/.exec(partialContent);
	const oldStringMatch = /<oldString>([\s\S]*?)(?:<\/oldString>|$)/.exec(partialContent);
	const newStringMatch = /<newString>([\s\S]*?)(?:<\/newString>|$)/.exec(partialContent);
	const replaceAllMatch = /<replaceAll>([\s\S]*?)(?:<\/replaceAll>|$)/.exec(partialContent);

	// Return incomplete command with whatever we have so far
	// This hides the command during streaming until it's renderable
	return {
		title: titleMatch ? titleMatch[1].trim() : '',
		oldString: oldStringMatch ? oldStringMatch[1] : '',
		newString: newStringMatch ? newStringMatch[1] : '',
		replaceAll: replaceAllMatch ? replaceAllMatch[1].trim() === 'true' : false,
		isIncomplete: true,
	};
}

/**
 * Parse a message and extract all content (text and commands)
 * Returns an array of parsed items in order, including text segments
 * Incomplete commands (without closing tags) are marked as isComplete: false
 */
export function parseMessage(message: MessageWithContent): ParsedMessageItem[] {
	if (message.type !== 'ai') {
		return [{ type: 'text' as const, content: message.content }];
	}

	const items: ParsedMessageItem[] = [];

	// Check for incomplete commands (only one can exist at a time during streaming)
	const partialCreate = parsePartialArtifactCreate(message.content);
	const partialEdit = parsePartialArtifactEdit(message.content);

	// Determine which incomplete command appears last (if any)
	const createStart = message.content.lastIndexOf('<command:artifact-create>');
	const editStart = message.content.lastIndexOf('<command:artifact-edit>');

	if (partialCreate?.isIncomplete && createStart > editStart) {
		// Incomplete artifact-create command
		if (createStart > 0) {
			const textBefore = message.content.substring(0, createStart).trim();
			if (textBefore) {
				items.push({ type: 'text', content: textBefore });
			}
		}

		items.push({
			type: 'artifact-create',
			command: partialCreate,
		});

		return items;
	} else if (partialEdit?.isIncomplete && editStart > createStart) {
		// Incomplete artifact-edit command
		if (editStart > 0) {
			const textBefore = message.content.substring(0, editStart).trim();
			if (textBefore) {
				items.push({ type: 'text', content: textBefore });
			}
		}

		items.push({
			type: 'artifact-edit',
			command: partialEdit,
		});

		return items;
	}

	// Find all command blocks (both valid and invalid) to skip them
	const commandBlocks: Array<{ start: number; end: number; item: ParsedMessageItem | null }> = [];

	// Find all artifact-create command blocks
	const createRegex = /<command:artifact-create>([\s\S]*?)<\/command:artifact-create>/g;
	let match;
	while ((match = createRegex.exec(message.content)) !== null) {
		const commands = parseArtifactCreateCommands(match[0]);
		commandBlocks.push({
			start: match.index,
			end: match.index + match[0].length,
			item: commands.length > 0 ? { type: 'artifact-create', command: commands[0] } : null,
		});
	}

	// Find all artifact-edit command blocks
	const editRegex = /<command:artifact-edit>([\s\S]*?)<\/command:artifact-edit>/g;
	while ((match = editRegex.exec(message.content)) !== null) {
		const commands = parseArtifactEditCommands(match[0]);
		commandBlocks.push({
			start: match.index,
			end: match.index + match[0].length,
			item: commands.length > 0 ? { type: 'artifact-edit', command: commands[0] } : null,
		});
	}

	// Sort by position
	commandBlocks.sort((a, b) => a.start - b.start);

	// Build items array with text and valid commands in order (skip invalid commands)
	let currentPos = 0;
	for (const { start, end, item } of commandBlocks) {
		// Add text before this command block
		if (start > currentPos) {
			const text = message.content.substring(currentPos, start).trim();
			if (text) {
				items.push({ type: 'text', content: text });
			}
		}

		// Add the command only if it's valid (item is not null)
		if (item) {
			items.push(item);
		}

		// Skip over this command block (valid or invalid)
		currentPos = end;
	}

	// Add remaining text after all commands
	if (currentPos < message.content.length) {
		const text = message.content.substring(currentPos).trim();
		if (text) {
			items.push({ type: 'text', content: text });
		}
	}

	// Strip any trailing incomplete or complete opening tag during streaming
	// This prevents flickering when tags arrive character by character
	// e.g., "<com", "<command:", "<command:artifact-c", "<command:artifact-create>", etc.
	// We only check for "<com" or longer to avoid stripping legitimate content like "a < b"
	if (items.length > 0) {
		const lastItem = items[items.length - 1];
		if (lastItem.type === 'text') {
			const lastOpenBracket = lastItem.content.lastIndexOf('<');
			if (lastOpenBracket !== -1) {
				const afterBracket = lastItem.content.substring(lastOpenBracket);
				// Check if it's a command tag prefix (incomplete or complete opening tag)
				const isCommandPrefix =
					afterBracket.length >= 4 && // At least "<com"
					(afterBracket === '<command:artifact-create>' ||
						afterBracket === '<command:artifact-edit>' ||
						'<command:artifact-create>'.startsWith(afterBracket) ||
						'<command:artifact-edit>'.startsWith(afterBracket));

				if (isCommandPrefix) {
					const trimmedContent = lastItem.content.substring(0, lastOpenBracket).trim();
					if (trimmedContent) {
						lastItem.content = trimmedContent;
					} else {
						// Remove the last item entirely if it only contained the partial tag
						items.pop();
					}
				}
			}
		}
	}

	return items;
}

/**
 * Reconstruct all artifacts from message history
 * Supports streaming by parsing partial commands in the last message
 * Returns an array of all artifacts created in the conversation
 */
export function reconstructArtifacts(messages: MessageWithContent[]): ChatArtifact[] {
	const artifacts: ChatArtifact[] = [];

	for (const message of messages) {
		// Parse all commands in this message
		const items = parseMessage(message);

		for (const item of items) {
			if (item.type === 'artifact-create') {
				artifacts.push({
					title: item.command.title,
					type: item.command.type,
					content: item.command.content,
					isIncomplete: item.command.isIncomplete,
					updatedIn: message.id,
				});
			} else if (item.type === 'artifact-edit') {
				// Find document by title
				const targetDoc = artifacts.find((doc) => doc.title === item.command.title);

				if (targetDoc) {
					if (item.command.replaceAll) {
						targetDoc.content = targetDoc.content
							.split(item.command.oldString)
							.join(item.command.newString);
					} else {
						targetDoc.content = targetDoc.content.replace(
							item.command.oldString,
							item.command.newString,
						);
					}
					targetDoc.updatedIn = message.id;
				}
			}
		}
	}

	return artifacts;
}
