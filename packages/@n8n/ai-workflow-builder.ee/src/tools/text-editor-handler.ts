/**
 * Text Editor Handler
 *
 * Handles text editor tool commands for the code builder agent.
 * Implements the Anthropic str_replace_based_edit_tool interface for
 * managing workflow code as a virtual file (/workflow.ts).
 */

import type {
	TextEditorCommand,
	ViewCommand,
	CreateCommand,
	StrReplaceCommand,
	InsertCommand,
} from '../types/text-editor';
import {
	NoMatchFoundError,
	MultipleMatchesError,
	InvalidLineNumberError,
	InvalidPathError,
	FileExistsError,
	FileNotFoundError,
} from '../types/text-editor';

/** The only supported file path for workflow code */
const WORKFLOW_FILE_PATH = '/workflow.ts';

/**
 * Handler for text editor tool commands
 *
 * Manages a single virtual file (/workflow.ts) containing workflow SDK code.
 * Supports view, create, str_replace, insert, and finalize commands.
 */
export class TextEditorHandler {
	private code: string | null = null;

	/**
	 * Execute a text editor command
	 *
	 * @param command - The command to execute
	 * @returns Result message for the LLM
	 * @throws Various errors for invalid operations
	 */
	execute(command: TextEditorCommand): string {
		// Validate path for all commands
		this.validatePath(command.path);

		switch (command.command) {
			case 'view':
				return this.handleView(command);
			case 'create':
				return this.handleCreate(command);
			case 'str_replace':
				return this.handleStrReplace(command);
			case 'insert':
				return this.handleInsert(command);
			case 'finalize':
				// Finalize is handled separately by the agent
				// This should not be called directly on execute
				return 'Finalize command should be handled by the agent.';
			default:
				return `Unknown command: ${(command as { command: string }).command}`;
		}
	}

	/**
	 * Validate that the path is the supported workflow file
	 */
	private validatePath(path: string): void {
		if (path !== WORKFLOW_FILE_PATH) {
			throw new InvalidPathError(path);
		}
	}

	/**
	 * Handle view command - display file content with line numbers
	 */
	private handleView(command: ViewCommand): string {
		if (!this.code) {
			throw new FileNotFoundError();
		}

		const lines = this.code.split('\n');

		// Handle view_range if specified
		if (command.view_range) {
			const [start, end] = command.view_range;

			// Validate range (1-indexed)
			if (start < 1 || end < start || start > lines.length) {
				throw new InvalidLineNumberError(start, lines.length);
			}

			// Convert to 0-indexed and extract range
			const startIdx = start - 1;
			const endIdx = Math.min(end, lines.length);
			const selectedLines = lines.slice(startIdx, endIdx);

			return selectedLines.map((line, i) => `${startIdx + i + 1}: ${line}`).join('\n');
		}

		// Return full file with line numbers
		return lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
	}

	/**
	 * Handle create command - create new file with content
	 */
	private handleCreate(command: CreateCommand): string {
		if (this.code !== null) {
			throw new FileExistsError();
		}

		this.code = command.file_text;
		return 'File created successfully.';
	}

	/**
	 * Handle str_replace command - replace exact string match
	 */
	private handleStrReplace(command: StrReplaceCommand): string {
		if (this.code === null) {
			throw new FileNotFoundError();
		}

		const { old_str, new_str } = command;

		// Count occurrences
		const count = this.countOccurrences(this.code, old_str);

		if (count === 0) {
			throw new NoMatchFoundError(old_str);
		}

		if (count > 1) {
			throw new MultipleMatchesError(count);
		}

		// Replace the single occurrence
		this.code = this.code.replace(old_str, new_str);
		return 'Edit applied successfully.';
	}

	/**
	 * Handle insert command - insert text at specific line
	 */
	private handleInsert(command: InsertCommand): string {
		if (this.code === null) {
			throw new FileNotFoundError();
		}

		const { insert_line, new_str } = command;
		const lines = this.code.split('\n');

		// Validate line number (0 = beginning, 1-n = after that line)
		if (insert_line < 0 || insert_line > lines.length) {
			throw new InvalidLineNumberError(insert_line, lines.length);
		}

		// Insert at the specified position
		lines.splice(insert_line, 0, new_str);
		this.code = lines.join('\n');

		return 'Text inserted successfully.';
	}

	/**
	 * Count non-overlapping occurrences of a substring
	 */
	private countOccurrences(text: string, search: string): number {
		if (search.length === 0) {
			return 0;
		}

		let count = 0;
		let pos = 0;

		while ((pos = text.indexOf(search, pos)) !== -1) {
			count++;
			pos += search.length;
		}

		return count;
	}

	/**
	 * Get the current workflow code
	 */
	getWorkflowCode(): string | null {
		return this.code;
	}

	/**
	 * Set the workflow code (for pre-populating with existing workflow)
	 */
	setWorkflowCode(code: string): void {
		this.code = code;
	}

	/**
	 * Check if workflow code exists
	 */
	hasWorkflowCode(): boolean {
		return this.code !== null;
	}

	/**
	 * Clear the workflow code
	 */
	clearWorkflowCode(): void {
		this.code = null;
	}
}
