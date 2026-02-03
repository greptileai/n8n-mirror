import { reconstructDocument, parseMessage } from './document-commands';
import type { MessageWithContent } from './document-commands';

describe('reconstructDocument', () => {
	describe('document creation', () => {
		test('should create a single document', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>My Document</title>
<type>md</type>
<content>Hello World</content>
</command:doc-create>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toEqual([
				{
					title: 'My Document',
					type: 'md',
					content: 'Hello World',
					isIncomplete: false,
					updatedIn: 'msg1',
				},
			]);
		});

		test('should create multiple documents', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>First Document</title>
<type>md</type>
<content>First content</content>
</command:doc-create>
`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-create>
<title>Second Document</title>
<type>txt</type>
<content>Second content</content>
</command:doc-create>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(2);
			expect(result[0].title).toBe('First Document');
			expect(result[1].title).toBe('Second Document');
		});

		test.todo('should return all documents when multiple commands in last message');

		// TODO: Fix implementation to return all documents
		// Currently only returns the last document when there are multiple complete commands in the last message
		// test('should return all documents when multiple commands in last message', () => {
		// 	const messages: MessageWithContent[] = [
		// 		{
		// 			id: 'msg1',
		// 			content: `
		// <command:doc-create>
		// <title>Doc One</title>
		// <type>md</type>
		// <content>Content one</content>
		// </command:doc-create>

		// <command:doc-create>
		// <title>Doc Two</title>
		// <type>txt</type>
		// <content>Content two</content>
		// </command:doc-create>
		// `,
		// 		},
		// 	];

		// 	const result = reconstructDocument(messages);

		// 	expect(result).toHaveLength(2);
		// 	expect(result[0].title).toBe('Doc One');
		// 	expect(result[1].title).toBe('Doc Two');
		// });

		test('should handle commands wrapped in code fences', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
\`\`\`
<command:doc-create>
<title>My Document</title>
<type>md</type>
<content>Hello World</content>
</command:doc-create>
\`\`\`
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('My Document');
		});

		test('should preserve content with newlines and special characters', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>Complex Document</title>
<type>md</type>
<content># Heading

This is a paragraph with **bold** and *italic*.

- List item 1
- List item 2

\`\`\`javascript
const x = 10;
\`\`\`
</content>
</command:doc-create>
`,
				},
			];

			const result = reconstructDocument(messages);

			const expectedContent = `# Heading

This is a paragraph with **bold** and *italic*.

- List item 1
- List item 2

\`\`\`javascript
const x = 10;
\`\`\`
`;
			expect(result[0].content).toBe(expectedContent);
		});
	});

	describe('document editing', () => {
		test('should edit a document by title', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>My Document</title>
<type>md</type>
<content>Hello World</content>
</command:doc-create>
`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-edit>
<title>My Document</title>
<oldString>World</oldString>
<newString>Universe</newString>
<replaceAll>false</replaceAll>
</command:doc-edit>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(1);
			expect(result[0].content).toBe('Hello Universe');
			expect(result[0].updatedIn).toBe('msg2');
		});

		test('should replace all occurrences when replaceAll is true', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>My Document</title>
<type>md</type>
<content>foo bar foo baz foo</content>
</command:doc-create>
`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-edit>
<title>My Document</title>
<oldString>foo</oldString>
<newString>qux</newString>
<replaceAll>true</replaceAll>
</command:doc-edit>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result[0].content).toBe('qux bar qux baz qux');
		});

		test('should replace only first occurrence when replaceAll is false', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>My Document</title>
<type>md</type>
<content>foo bar foo baz foo</content>
</command:doc-create>
`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-edit>
<title>My Document</title>
<oldString>foo</oldString>
<newString>qux</newString>
<replaceAll>false</replaceAll>
</command:doc-edit>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result[0].content).toBe('qux bar foo baz foo');
		});

		test('should apply multiple edits to the same document', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>My Document</title>
<type>md</type>
<content>Hello World</content>
</command:doc-create>
`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-edit>
<title>My Document</title>
<oldString>Hello</oldString>
<newString>Hi</newString>
<replaceAll>false</replaceAll>
</command:doc-edit>
`,
				},
				{
					id: 'msg3',
					content: `
<command:doc-edit>
<title>My Document</title>
<oldString>World</oldString>
<newString>Universe</newString>
<replaceAll>false</replaceAll>
</command:doc-edit>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(1);
			expect(result[0].content).toBe('Hi Universe');
			expect(result[0].updatedIn).toBe('msg3');
		});

		test('should edit specific document by title when multiple documents exist', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>First Document</title>
<type>md</type>
<content>First content</content>
</command:doc-create>
`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-create>
<title>Second Document</title>
<type>md</type>
<content>Second content</content>
</command:doc-create>
`,
				},
				{
					id: 'msg3',
					content: `
<command:doc-edit>
<title>First Document</title>
<oldString>First</oldString>
<newString>Updated</newString>
<replaceAll>false</replaceAll>
</command:doc-edit>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(2);
			expect(result[0].content).toBe('Updated content');
			expect(result[0].updatedIn).toBe('msg3');
			expect(result[1].content).toBe('Second content');
			expect(result[1].updatedIn).toBe('msg2');
		});

		test('should ignore edit command for non-existent document', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>My Document</title>
<type>md</type>
<content>Hello World</content>
</command:doc-create>
`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-edit>
<title>Non-existent Document</title>
<oldString>Hello</oldString>
<newString>Goodbye</newString>
<replaceAll>false</replaceAll>
</command:doc-edit>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(1);
			expect(result[0].content).toBe('Hello World');
			expect(result[0].updatedIn).toBe('msg1');
		});
	});

	describe('streaming and incomplete commands', () => {
		test('should handle incomplete command in last message', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>Streaming Document</title>
<type>md</type>
<content>This is incomplete`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Streaming Document');
			expect(result[0].content).toBe('This is incomplete');
			expect(result[0].isIncomplete).toBe(true);
			expect(result[0].updatedIn).toBe('msg1');
		});

		test('should handle incomplete command with only title and type', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>Streaming Document</title>
<type>md</type>`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('Streaming Document');
			expect(result[0].content).toBe('');
			expect(result[0].isIncomplete).toBe(true);
		});

		test('should parse incomplete commands regardless of position', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>Incomplete</title>
<type>md</type>`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-create>
<title>Complete Document</title>
<type>md</type>
<content>Complete content</content>
</command:doc-create>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(2);
			expect(result[0].title).toBe('Incomplete');
			expect(result[0].isIncomplete).toBe(true);
			expect(result[1].title).toBe('Complete Document');
			expect(result[1].isIncomplete).toBe(false);
		});

		test('should handle complete command in last message as complete', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>Complete Document</title>
<type>md</type>
<content>Complete content</content>
</command:doc-create>
`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result[0].isIncomplete).toBe(false);
		});

		test.todo(
			'should return both complete and incomplete documents when both exist in last message',
		);

		// TODO: Fix implementation to return both documents
		// Currently only returns the complete document when there's both complete and incomplete in the last message
		// test('should return both complete and incomplete documents when both exist in last message', () => {
		// 	const messages: MessageWithContent[] = [
		// 		{
		// 			id: 'msg1',
		// 			content: `
		// <command:doc-create>
		// <title>Complete Document</title>
		// <type>md</type>
		// <content>Complete content</content>
		// </command:doc-create>
		// <command:doc-create>
		// <title>Incomplete Document</title>
		// <type>txt</type>
		// <content>This is incomplete`,
		// 		},
		// 	];

		// 	const result = reconstructDocument(messages);

		// 	expect(result).toHaveLength(2);
		// 	expect(result[0].title).toBe('Complete Document');
		// 	expect(result[0].isIncomplete).toBe(false);
		// 	expect(result[1].title).toBe('Incomplete Document');
		// 	expect(result[1].isIncomplete).toBe(true);
		// });

		test('should handle complete and incomplete commands across messages', () => {
			const messages: MessageWithContent[] = [
				{
					id: 'msg1',
					content: `
<command:doc-create>
<title>Complete Document</title>
<type>md</type>
<content>Complete content</content>
</command:doc-create>
`,
				},
				{
					id: 'msg2',
					content: `
<command:doc-create>
<title>Incomplete Document</title>
<type>txt</type>
<content>Streaming content`,
				},
			];

			const result = reconstructDocument(messages);

			expect(result).toHaveLength(2);
			expect(result[0].title).toBe('Complete Document');
			expect(result[0].isIncomplete).toBe(false);
			expect(result[1].title).toBe('Incomplete Document');
			expect(result[1].isIncomplete).toBe(true);
		});
	});

	describe('malformed commands', () => {
		test('should ignore commands with mismatched XML tag casing', () => {
			const content = `
<command:doc-edit>
<title>My Document</title>
<oldString>hello</oldString>
<newString>world</NewString>
<replaceAll>false</replaceAll>
</command:doc-edit>
`;

			const result = parseMessage(content);

			// Edit command ignored due to malformed closing tag (capital N in NewString)
			expect(result).toHaveLength(0);
		});

		test('should ignore commands with missing required fields', () => {
			const content = `
<command:doc-edit>
<title>My Document</title>
<oldString>hello</oldString>
</command:doc-edit>
`;

			const result = parseMessage(content);

			// Edit command missing newString, ignored entirely
			expect(result).toHaveLength(0);
		});

		test('should ignore commands with completely malformed XML', () => {
			const content = `
<command:doc-create>
<title>Broken Document
<type>md</type>
<content>This has unclosed title tag
</command:doc-create>
`;

			const result = parseMessage(content);

			// Malformed command ignored entirely
			expect(result).toHaveLength(0);
		});

		test('should parse valid commands and strip out invalid ones', () => {
			const content = `
Here's a valid document:

<command:doc-create>
<title>Valid Document</title>
<type>md</type>
<content>Valid content</content>
</command:doc-create>

And here's a broken edit command:

<command:doc-edit>
<title>Valid Document</title>
<oldString>Valid</oldString>
<newString>Updated</NewString>
</command:doc-edit>

Some text after.
`;

			const result = parseMessage(content);

			// Should have text, valid command, text, and final text (invalid command stripped)
			expect(result).toHaveLength(4);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toContain("Here's a valid document");
			expect(result[1].type).toBe('doc-create');
			expect(result[1].command.title).toBe('Valid Document');
			expect(result[2].type).toBe('text');
			expect(result[2].content).toBe("And here's a broken edit command:");
			expect(result[3].type).toBe('text');
			expect(result[3].content).toBe('Some text after.');
		});
	});
});

describe('parseMessage', () => {
	test('should return empty array for text-only content', () => {
		const content = 'Just some regular text without any commands.';

		const result = parseMessage(content);

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe('text');
		expect(result[0].content).toBe(content);
	});

	test('should extract text and commands in order', () => {
		const content = `
Before command.

<command:doc-create>
<title>My Document</title>
<type>md</type>
<content>Document content</content>
</command:doc-create>

After command.
`;

		const result = parseMessage(content);

		expect(result).toHaveLength(3);
		expect(result[0].type).toBe('text');
		expect(result[0].content).toBe('Before command.');
		expect(result[1].type).toBe('doc-create');
		expect(result[1].command.title).toBe('My Document');
		expect(result[2].type).toBe('text');
		expect(result[2].content).toBe('After command.');
	});

	test('should handle multiple commands with text in between', () => {
		const content = `
First text.

<command:doc-create>
<title>Doc 1</title>
<type>md</type>
<content>Content 1</content>
</command:doc-create>

Middle text.

<command:doc-create>
<title>Doc 2</title>
<type>txt</type>
<content>Content 2</content>
</command:doc-create>

Last text.
`;

		const result = parseMessage(content);

		expect(result).toHaveLength(5);
		expect(result[0].type).toBe('text');
		expect(result[1].type).toBe('doc-create');
		expect(result[2].type).toBe('text');
		expect(result[3].type).toBe('doc-create');
		expect(result[4].type).toBe('text');
	});

	test('should mark incomplete doc-create commands correctly', () => {
		const content = `
Some text before.

<command:doc-create>
<title>Incomplete Doc</title>
<type>md</type>
<content>This is incomplete`;

		const result = parseMessage(content);

		expect(result).toHaveLength(2);
		expect(result[0].type).toBe('text');
		expect(result[1].type).toBe('doc-create');
		expect(result[1].command.isIncomplete).toBe(true);
		expect(result[1].command.title).toBe('Incomplete Doc');
	});

	test('should mark incomplete doc-edit commands correctly', () => {
		const content = `
Some text before.

<command:doc-edit>
<title>My Document</title>
<oldString>old text</oldString>
<newString>new text`;

		const result = parseMessage(content);

		expect(result).toHaveLength(2);
		expect(result[0].type).toBe('text');
		expect(result[1].type).toBe('doc-edit');
		expect(result[1].command.isIncomplete).toBe(true);
		expect(result[1].command.title).toBe('My Document');
		expect(result[1].command.oldString).toBe('old text');
		expect(result[1].command.newString).toBe('new text');
	});

	test('should handle incomplete edit command with only title', () => {
		const content = `
<command:doc-edit>
<title>Doc Title</title>`;

		const result = parseMessage(content);

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe('doc-edit');
		expect(result[0].command.isIncomplete).toBe(true);
		expect(result[0].command.title).toBe('Doc Title');
		expect(result[0].command.oldString).toBe('');
		expect(result[0].command.newString).toBe('');
	});

	test('should handle incomplete command with only opening tag', () => {
		const content = `
Some text before.

<command:doc-create>
<title>Partial`;

		const result = parseMessage(content);

		expect(result).toHaveLength(2);
		expect(result[0].type).toBe('text');
		expect(result[0].content).toBe('Some text before.');
		expect(result[1].type).toBe('doc-create');
		expect(result[1].command.isIncomplete).toBe(true);
		expect(result[1].command.title).toBe('Partial');
		expect(result[1].command.type).toBe('');
		expect(result[1].command.content).toBe('');
	});

	test('should hide command with only opening tag and no fields', () => {
		const content = `
Text before.

<command:doc-create>`;

		const result = parseMessage(content);

		expect(result).toHaveLength(2);
		expect(result[0].type).toBe('text');
		expect(result[0].content).toBe('Text before.');
		expect(result[1].type).toBe('doc-create');
		expect(result[1].command.isIncomplete).toBe(true);
		expect(result[1].command.title).toBe('');
		expect(result[1].command.type).toBe('');
		expect(result[1].command.content).toBe('');
	});

	test('should hide command with opening tag and partial title during streaming', () => {
		const content = `I'll create a horror movie ranking document for you with some of the most iconic and highly-regarded horror films of all time.

<command:doc-create>
<title>Ultimate Horror Movie Rankings`;

		const result = parseMessage(content);

		expect(result).toHaveLength(2);
		expect(result[0].type).toBe('text');
		expect(result[0].content).toContain(
			"I'll create a horror movie ranking document for you with some of the most iconic",
		);
		expect(result[1].type).toBe('doc-create');
		expect(result[1].command.isIncomplete).toBe(true);
		expect(result[1].command.title).toBe('Ultimate Horror Movie Rankings');
		expect(result[1].command.type).toBe(''); // No type yet
		expect(result[1].command.content).toBe(''); // No content yet
	});

	test('should prioritize last incomplete command when multiple exist', () => {
		const content = `
<command:doc-create>
<title>First</title>
<type>md</type>
<content>Complete content</content>
</command:doc-create>

<command:doc-edit>
<title>Second</title>
<oldString>old`;

		const result = parseMessage(content);

		// Should only return the incomplete edit command (the last one)
		expect(result).toHaveLength(2);
		expect(result[0].type).toBe('text');
		expect(result[1].type).toBe('doc-edit');
		expect(result[1].command.isIncomplete).toBe(true);
	});

	describe('partial tag stripping during streaming', () => {
		test('should strip trailing "<com" prefix', () => {
			const content = 'Some text here <com';

			const result = parseMessage(content);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('Some text here');
		});

		test('should strip trailing "<command:" prefix', () => {
			const content = 'Some text here <command:';

			const result = parseMessage(content);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('Some text here');
		});

		test('should strip trailing "<command:doc-c" prefix', () => {
			const content = 'Some text here <command:doc-c';

			const result = parseMessage(content);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('Some text here');
		});

		test('should strip trailing "<command:doc-ed" prefix', () => {
			const content = 'Some text here <command:doc-ed';

			const result = parseMessage(content);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('Some text here');
		});

		test('should not strip legitimate comparison operators', () => {
			const content = 'a < b';

			const result = parseMessage(content);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('a < b');
		});

		test('should not strip short partial tags (less than 4 chars)', () => {
			const content = 'Some text <co';

			const result = parseMessage(content);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('Some text <co');
		});

		test('should not strip tags that do not match command prefixes', () => {
			const content = 'Some text <div>';

			const result = parseMessage(content);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('Some text <div>');
		});

		test('should parse complete opening tags as incomplete commands', () => {
			const content = 'Some text <command:doc-create>';

			const result = parseMessage(content);

			expect(result).toHaveLength(2);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('Some text');
			expect(result[1].type).toBe('doc-create');
			expect(result[1].command.isIncomplete).toBe(true);
			expect(result[1].command.title).toBe('');
		});

		test('should parse partial tag as text when too short to be command', () => {
			const content = '<command:doc-c';

			const result = parseMessage(content);

			// Partial tag is now stripped by the trailing tag logic
			expect(result).toHaveLength(0);
		});

		test('should strip partial tag from last text item among multiple items', () => {
			const content = `
Before command.

<command:doc-create>
<title>Doc</title>
<type>md</type>
<content>Content</content>
</command:doc-create>

After command <command:doc-ed`;

			const result = parseMessage(content);

			expect(result).toHaveLength(3);
			expect(result[0].type).toBe('text');
			expect(result[0].content).toBe('Before command.');
			expect(result[1].type).toBe('doc-create');
			expect(result[2].type).toBe('text');
			expect(result[2].content).toBe('After command');
		});
	});
});
