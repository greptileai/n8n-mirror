// Example: Custom Chat History Storage
// Demonstrates extending BaseChatHistory for custom backends.
// Usage: npx ts-node examples/memory/custom-storage.ts

import { BaseChatHistory, WindowedChatMemory, type Message } from '../../src';

// Simulated file-based storage
class FileChatHistory extends BaseChatHistory {
	private storage: Map<string, Message[]> = new Map();

	constructor(private filePath: string) {
		super();
		console.log(`[FileChatHistory] Initialized with path: ${filePath}`);
	}

	async getMessages(): Promise<Message[]> {
		console.log(`[FileChatHistory] Reading from ${this.filePath}`);
		return this.storage.get(this.filePath) ?? [];
	}

	async addMessage(message: Message): Promise<void> {
		console.log(`[FileChatHistory] Appending to ${this.filePath}`);
		const messages = this.storage.get(this.filePath) ?? [];
		messages.push(message);
		this.storage.set(this.filePath, messages);
	}

	async clear(): Promise<void> {
		console.log(`[FileChatHistory] Clearing ${this.filePath}`);
		this.storage.delete(this.filePath);
	}
}

// Simulated API-based storage
class ApiChatHistory extends BaseChatHistory {
	private mockDatabase: Message[] = [];

	constructor(
		private baseUrl: string,
		private sessionId: string,
	) {
		super();
		console.log(`[ApiChatHistory] Initialized for session: ${sessionId}`);
	}

	async getMessages(): Promise<Message[]> {
		console.log(`[ApiChatHistory] GET ${this.baseUrl}/sessions/${this.sessionId}/messages`);
		return [...this.mockDatabase];
	}

	async addMessage(message: Message): Promise<void> {
		console.log(`[ApiChatHistory] POST ${this.baseUrl}/sessions/${this.sessionId}/messages`);
		this.mockDatabase.push(message);
	}

	async clear(): Promise<void> {
		console.log(`[ApiChatHistory] DELETE ${this.baseUrl}/sessions/${this.sessionId}`);
		this.mockDatabase = [];
	}
}

async function demonstrateFileChatHistory() {
	console.log('\n=== File-based Chat History Demo ===\n');

	const history = new FileChatHistory('/tmp/chat-session-abc.json');
	const memory = new WindowedChatMemory(history, { windowSize: 3 });

	await memory.saveContext('Hello', 'Hi there!');
	await memory.saveContext('How are you?', 'I am doing well!');

	const messages = await memory.loadMessages();
	console.log(`\nLoaded ${messages.length} messages\n`);
}

async function demonstrateApiChatHistory() {
	console.log('\n=== API-based Chat History Demo ===\n');

	const history = new ApiChatHistory('https://api.example.com', 'session-xyz-789');
	const memory = new WindowedChatMemory(history, { windowSize: 10 });

	await memory.saveContext('What is the weather?', 'It is sunny and 72°F.');
	await memory.saveContext('Thanks!', 'You are welcome!');

	const messages = await memory.loadMessages();
	console.log(`\nLoaded ${messages.length} messages`);

	for (const msg of messages) {
		const text = msg.content
			.filter((c): c is { type: 'text'; text: string } => c.type === 'text')
			.map((c) => c.text)
			.join('');
		console.log(`  [${msg.role}]: ${text}`);
	}
}

async function main() {
	console.log('=== Custom Storage Examples ===');

	await demonstrateFileChatHistory();
	await demonstrateApiChatHistory();

	console.log('\n=== Examples Complete ===\n');
}

main().catch(console.error);
