// Example: Using InMemoryChatHistory with WindowedChatMemory
// Usage: npx ts-node examples/memory/in-memory.ts

import { InMemoryChatHistory, WindowedChatMemory } from '../../src';

async function main() {
	console.log('=== Memory SDK Example: In-Memory Storage ===\n');

	const sessionId = 'example-session-123';
	const history = new InMemoryChatHistory(sessionId);
	const memory = new WindowedChatMemory(history, { windowSize: 5 });

	console.log('1. Initial state (empty):');
	let messages = await memory.loadMessages();
	console.log(`   Messages: ${messages.length}`);

	console.log('\n2. Saving conversation turns...');

	await memory.saveContext('Hello!', 'Hi there! How can I help you today?');
	console.log('   Saved: "Hello!" -> "Hi there! How can I help you today?"');

	await memory.saveContext('What is 2+2?', 'The answer is 4.');
	console.log('   Saved: "What is 2+2?" -> "The answer is 4."');

	await memory.saveContext(
		'Tell me a joke',
		'Why did the scarecrow win an award? Because he was outstanding in his field!',
	);
	console.log('   Saved: "Tell me a joke" -> "Why did the scarecrow..."');

	console.log('\n3. Loading messages:');
	messages = await memory.loadMessages();
	console.log(`   Total messages: ${messages.length}`);

	for (const msg of messages) {
		const text = msg.content
			.filter((c): c is { type: 'text'; text: string } => c.type === 'text')
			.map((c) => c.text)
			.join('');
		console.log(`   [${msg.role}]: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
	}

	console.log('\n4. Testing window size (adding more messages)...');

	for (let i = 4; i <= 8; i++) {
		await memory.saveContext(`Question ${i}`, `Answer ${i}`);
	}

	messages = await memory.loadMessages();
	console.log(`   Total messages after adding 5 more pairs: ${messages.length}`);
	console.log('   (Window size is 5 pairs = 10 messages max)');

	console.log('\n5. Clearing memory...');
	await memory.clear();

	messages = await memory.loadMessages();
	console.log(`   Messages after clear: ${messages.length}`);

	console.log('\n=== Example Complete ===');
}

main().catch(console.error);
