# AI Node SDK Interface Specification

This document defines the ideal public API for the `@n8n/ai-node-sdk` package, enabling community developers to build AI nodes (chat models and memory) without requiring knowledge of LangChain internals.

## Design Goals

1. **Hide LangChain from community developers** - The SDK abstracts all LangChain-specific code
2. **Stable interfaces** - Public API won't break when internal implementations change
3. **Progressive disclosure** - Simple cases are simple, complex cases are possible

---

## Factory Functions

### createChatModel

Two modes available:

```typescript
import { createChatModel } from '@n8n/ai-node-sdk';

// Mode 1: OpenAI-compatible APIs (covers ~90% of providers)
const model = createChatModel({
  type: 'openaiCompatible',
  baseUrl: 'https://api.openrouter.ai/api/v1',
  apiKey: credentials.apiKey,
  model: 'openai/gpt-4',
  temperature: 0.7,
  maxTokens: 4096,
});

return { response: model };

// Mode 2: Custom APIs (for non-OpenAI-compatible providers)
const model = createChatModel({
  type: 'custom',
  generate: async (messages) => {
    const response = await this.helpers.httpRequest({ ... });
    return { text: response.reply, toolCalls: response.actions };
  },
});

return { response: model };
```

### createMemory

```typescript
import { createMemory, logWrapper } from '@n8n/ai-node-sdk';

// Buffer window memory - keeps last K messages
const memory = createMemory({
  type: 'bufferWindow',
  k: 10,
  sessionId: 'user-123',
  chatHistory: customStorage, // optional: custom ChatHistory implementation
});

// Buffer memory - keeps all messages
const memory = createMemory({
  type: 'buffer',
  sessionId: 'user-123',
});

// Token buffer memory - trims by token count
const memory = createMemory({
  type: 'tokenBuffer',
  maxTokens: 4000,
  sessionId: 'user-123',
});

// We use logWrapper explicitly
return { response: logWrapper(memory, this) };
```

### logWrapper

Enables n8n execution logging for memory nodes:

```typescript
import { logWrapper } from '@n8n/ai-node-sdk';

// Memory nodes - use logWrapper
const memory = createMemory({ ... });
return { response: logWrapper(memory, this) };

// Chat models - no logWrapper needed (to be confirmed)
const model = createChatModel({ ... });
return { response: model };
```

---

## Before/After Examples

### Example 1: LmChatOpenRouter

**Before (LangChain):**

```typescript
import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import { N8nLlmTracing } from '../N8nLlmTracing';
// ... other imports

async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
  const credentials = await this.getCredentials<OpenAICompatibleCredential>('openRouterApi');
  const modelName = this.getNodeParameter('model', itemIndex) as string;
  const options = this.getNodeParameter('options', itemIndex, {}) as { ... };

  const model = new ChatOpenAI({
    apiKey: credentials.apiKey,
    model: modelName,
    ...options,
    configuration: { baseURL: credentials.url, ... },
    callbacks: [new N8nLlmTracing(this)],  // Logging via LangChain callback
    onFailedAttempt: makeN8nLlmFailedAttemptHandler(this, openAiFailedAttemptHandler),
  });

  return { response: model };
}
```

**After (SDK):**

```typescript
import { createChatModel } from '@n8n/ai-node-sdk';

async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
  const credentials = await this.getCredentials<{ url: string; apiKey: string }>('openRouterApi');
  const modelName = this.getNodeParameter('model', itemIndex) as string;
  const options = this.getNodeParameter('options', itemIndex, {}) as { ... };

  const model = createChatModel({
    type: 'openaiCompatible',
    baseUrl: credentials.url,
    apiKey: credentials.apiKey,
    model: modelName,
    ...options,
  });

  return { response: model };
}
```

### Example 2: MemoryPostgresChat

**Before (LangChain):**

```typescript
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';
import { BufferWindowMemory } from '@langchain/classic/memory';
import { logWrapper } from '@utils/logWrapper';

async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
  const credentials = await this.getCredentials<PostgresNodeCredentials>('postgres');
  const tableName = this.getNodeParameter('tableName', itemIndex) as string;
  const sessionId = getSessionId(this, itemIndex);
  const k = this.getNodeParameter('contextWindowLength', itemIndex);

  const pgConf = await configurePostgres.call(this, credentials);
  const pool = pgConf.db.$pool;

  const pgChatHistory = new PostgresChatMessageHistory({ pool, sessionId, tableName });

  const memory = new BufferWindowMemory({
    memoryKey: 'chat_history',
    chatHistory: pgChatHistory,
    returnMessages: true,
    inputKey: 'input',
    outputKey: 'output',
    k,
  });

  return { response: logWrapper(memory, this) };
}
```

**After (SDK):**

```typescript
import { createMemory, logWrapper, type ChatHistory, type Message } from '@n8n/ai-node-sdk';

class PostgresChatHistory implements ChatHistory {
  constructor(private pool: pg.Pool, private sessionId: string, private tableName: string) {}

  async getMessages(): Promise<Message[]> {
    const result = await this.pool.query(
      `SELECT role, content FROM ${this.tableName} WHERE session_id = $1 ORDER BY created_at`,
      [this.sessionId],
    );
    return result.rows.map((row) => ({ role: row.role, content: row.content }));
  }

  async addMessage(message: Message): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.tableName} (session_id, role, content) VALUES ($1, $2, $3)`,
      [this.sessionId, message.role, message.content],
    );
  }

  async clear(): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.tableName} WHERE session_id = $1`, [this.sessionId]);
  }
}

async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
  const credentials = await this.getCredentials<PostgresNodeCredentials>('postgres');
  const tableName = this.getNodeParameter('tableName', itemIndex) as string;
  const sessionId = getSessionId(this, itemIndex);
  const k = this.getNodeParameter('contextWindowLength', itemIndex, 10) as number;

  const pgConf = await configurePostgres.call(this, credentials);
  const pool = pgConf.db.$pool;

  const chatHistory = new PostgresChatHistory(pool, sessionId, tableName);

  const memory = createMemory({
    type: 'bufferWindow',
    k,
    sessionId,
    chatHistory,
  });

  return { response: logWrapper(memory, this) };
}
```

---

## Community Node Examples

### ImaginaryLLM Chat Model (Custom API)

```typescript
import { createChatModel, type Message, type GenerateResult } from '@n8n/ai-node-sdk';
import { NodeConnectionTypes, type INodeType, type ISupplyDataFunctions, type SupplyData } from 'n8n-workflow';

export class LmChatImaginaryLlm implements INodeType {
  description = {
    displayName: 'ImaginaryLLM Chat Model',
    name: 'lmChatImaginaryLlm',
    outputs: [NodeConnectionTypes.AiLanguageModel],
    credentials: [{ name: 'imaginaryLlmApi', required: true }],
    properties: [
      { displayName: 'Model', name: 'model', type: 'options', options: [
        { name: 'Imaginary Pro', value: 'imaginary-pro' },
        { name: 'Imaginary Fast', value: 'imaginary-fast' },
      ], default: 'imaginary-pro' },
      { displayName: 'Temperature', name: 'temperature', type: 'number', default: 0.7 },
    ],
  };

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    const credentials = await this.getCredentials<{ apiKey: string }>('imaginaryLlmApi');
    const modelName = this.getNodeParameter('model', itemIndex) as string;
    const temperature = this.getNodeParameter('temperature', itemIndex) as number;

    const generate = async (messages: Message[]): Promise<GenerateResult> => {
      const response = await this.helpers.httpRequest({
        method: 'POST',
        url: 'https://api.imaginary-llm.example.com/v1/generate',
        headers: { 'Authorization': `Bearer ${credentials.apiKey}` },
        body: {
          model: modelName,
          conversation: messages.map((m) => ({ speaker: m.role, text: m.content })),
          settings: { creativity: temperature },
        },
      });

      return {
        text: response.reply.text,
        toolCalls: response.reply.actions?.map((a: any) => ({
          id: a.id, name: a.name, args: a.params,
        })),
      };
    };

    const model = createChatModel({ type: 'custom', generate });

    return { response: model };
  }
}
```

### ImaginaryDB Chat Memory

```typescript
import { createMemory, logWrapper, type ChatHistory, type Message } from '@n8n/ai-node-sdk';
import { NodeConnectionTypes, type INodeType, type ISupplyDataFunctions, type SupplyData } from 'n8n-workflow';

class ImaginaryDbChatHistory implements ChatHistory {
  constructor(private helpers: ISupplyDataFunctions['helpers'], private dbUrl: string, private sessionId: string) {}

  async getMessages(): Promise<Message[]> {
    const response = await this.helpers.httpRequest({ method: 'GET', url: `${this.dbUrl}/get/chat:${this.sessionId}` });
    return response.value ? JSON.parse(response.value) : [];
  }

  async addMessage(message: Message): Promise<void> {
    const messages = await this.getMessages();
    messages.push(message);
    await this.helpers.httpRequest({ method: 'POST', url: `${this.dbUrl}/set/chat:${this.sessionId}`, body: { value: JSON.stringify(messages) } });
  }

  async clear(): Promise<void> {
    await this.helpers.httpRequest({ method: 'DELETE', url: `${this.dbUrl}/del/chat:${this.sessionId}` });
  }
}

export class MemoryImaginaryDbChat implements INodeType {
  description = {
    displayName: 'ImaginaryDB Chat Memory',
    name: 'memoryImaginaryDbChat',
    outputs: [NodeConnectionTypes.AiMemory],
    credentials: [{ name: 'imaginaryDbApi', required: true }],
    properties: [
      { displayName: 'Session ID', name: 'sessionId', type: 'string', default: '={{ $json.sessionId }}' },
      { displayName: 'Context Window', name: 'contextWindow', type: 'number', default: 10 },
    ],
  };

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    const credentials = await this.getCredentials<{ url: string }>('imaginaryDbApi');
    const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;
    const k = this.getNodeParameter('contextWindow', itemIndex) as number;

    const chatHistory = new ImaginaryDbChatHistory(this.helpers, credentials.url, sessionId);

    const memory = createMemory({ type: 'bufferWindow', k, sessionId, chatHistory });

    return { response: logWrapper(memory, this) };
  }
}
```

---

## Summary

| Before (LangChain) | After (SDK) |
|--------------------|-------------|
| `import { ChatOpenAI } from '@langchain/openai'` | `import { createChatModel } from '@n8n/ai-node-sdk'` |
| `new ChatOpenAI({ callbacks: [...], ... })` | `createChatModel({ ... })` |
| `import { logWrapper } from '@utils/logWrapper'` | `import { logWrapper } from '@n8n/ai-node-sdk'` |
| Provider-specific classes | Single `createChatModel` |
| LangChain message types | Simple `Message` interface |
