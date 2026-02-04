# AI Node SDK Interface Specification

## Core Pattern

### Option A: OpenAI-Compatible APIs (easiest)

Use the built-in `OpenAIChatModel` with a custom `baseURL`:

```typescript
import { OpenAIChatModel, generateChatModelResponse } from '@n8n/ai-node-sdk';

const model = new OpenAIChatModel('model-name', {
  apiKey: 'your-api-key',
  baseURL: 'https://api.provider.com/v1',  // OpenRouter, DeepSeek, etc.
});

return { response: generateChatModelResponse(this, { model }) };
```

### Option B: Custom API (full control)

Extend `BaseChatModel` and implement `generate()` + `stream()`:

```typescript
import { BaseChatModel, generateChatModelResponse, type Message, type GenerateResult, type StreamChunk } from '@n8n/ai-node-sdk';

class MyChatModel extends BaseChatModel {
  async generate(messages: Message[]): Promise<GenerateResult> {
    // Call your API, convert messages to provider format...
    return { text: '...', toolCalls: [...] };
  }

  async *stream(messages: Message[]): AsyncIterable<StreamChunk> {
    // Stream from your API...
    yield { type: 'text-delta', textDelta: '...' };
    yield { type: 'finish', finishReason: 'stop' };
  }
}

const model = new MyChatModel('my-provider', 'model-id', { apiKey: '...' });
return { response: generateChatModelResponse(this, { model }) };
```

---

## Before/After Examples

### Example 1: LmChatOpenRouter

**Before (LangChain):**

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { N8nLlmTracing } from '../N8nLlmTracing';

async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
  const credentials = await this.getCredentials<OpenAICompatibleCredential>('openRouterApi');
  const modelName = this.getNodeParameter('model', itemIndex) as string;
  const options = this.getNodeParameter('options', itemIndex, {}) as { ... };

  const model = new ChatOpenAI({
    apiKey: credentials.apiKey,
    model: modelName,
    ...options,
    configuration: { baseURL: credentials.url, ... },
    callbacks: [new N8nLlmTracing(this)],
    onFailedAttempt: makeN8nLlmFailedAttemptHandler(this, openAiFailedAttemptHandler),
  });

  return { response: model };
}
```

**After (SDK):**

```typescript
import { OpenAIChatModel, generateChatModelResponse } from '@n8n/ai-node-sdk';

async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
  const credentials = await this.getCredentials<{ apiKey: string }>('openRouterApi');
  const modelName = this.getNodeParameter('model', itemIndex) as string;
  const options = this.getNodeParameter('options', itemIndex, {}) as { ... };

  // Reuse OpenAIChatModel with custom baseURL for OpenAI-compatible APIs
  const model = new OpenAIChatModel(modelName, {
    apiKey: credentials.apiKey,
    baseURL: credentials.url,
    ...options,
  });

  return { response: generateChatModelResponse(this, { model }) };
}
```

> **Note:** `OpenAIChatModel` is a built-in SDK class that implements the OpenAI Responses API.
> For OpenAI-compatible providers (OpenRouter, DeepSeek, etc.), just set `baseURL` to the provider's endpoint.

---

## Community Node Examples

### ImaginaryLLM Chat Model

```typescript
import {
  BaseChatModel,
  generateChatModelResponse,
  type Message,
  type GenerateResult,
  type StreamChunk,
  type ChatModelConfig,
} from '@n8n/ai-node-sdk';
import { NodeConnectionTypes, type INodeType, type ISupplyDataFunctions, type SupplyData } from 'n8n-workflow';

// Custom chat model extending BaseChatModel
class ImaginaryLlmChatModel extends BaseChatModel {
  constructor(
    private apiKey: string,
    modelId: string,
    config?: ChatModelConfig,
  ) {
    super('imaginary-llm', modelId, config);
  }

  async generate(messages: Message[], config?: ChatModelConfig): Promise<GenerateResult> {
    // Convert n8n messages to provider format
    const providerMessages = messages.map(m => ({
      speaker: m.role === 'human' ? 'user' : m.role === 'ai' ? 'bot' : m.role,
      text: m.content.find(c => c.type === 'text')?.text ?? '',
    }));

    // Call the API (using fetch or this.helpers.httpRequest in real node)
    const response = await fetch('https://api.imaginary-llm.example.com/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelId,
        conversation: providerMessages,
        settings: {
          creativity: config?.temperature ?? 0.7,
          max_length: config?.maxTokens,
        },
      }),
    });

    const data = await response.json();

    return {
      text: data.reply.text,
      toolCalls: data.reply.actions?.map((a: any) => ({
        id: a.id,
        name: a.name,
        arguments: a.params,  // already parsed object
      })),
      usage: data.metrics ? {
        promptTokens: data.metrics.input_tokens,
        completionTokens: data.metrics.output_tokens,
        totalTokens: data.metrics.input_tokens + data.metrics.output_tokens,
      } : undefined,
    };
  }

  async *stream(messages: Message[], config?: ChatModelConfig): AsyncIterable<StreamChunk> {
    // Streaming implementation...
    yield { type: 'text-delta', textDelta: '...' };
    yield { type: 'finish', finishReason: 'stop' };
  }
}

// The n8n node
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

    const model = new ImaginaryLlmChatModel(credentials.apiKey, modelName, { temperature });

    return { response: generateChatModelResponse(this, { model }) };
  }
}
```

---

## Summary

| Before (LangChain) | After (SDK) |
|--------------------|-------------|
| `import { ChatOpenAI } from '@langchain/openai'` | `import { OpenAIChatModel, generateChatModelResponse } from '@n8n/ai-node-sdk'` |
| `new ChatOpenAI({ ... })` | `new OpenAIChatModel(modelId, { baseURL, apiKey })` for OpenAI-compatible APIs |
| Custom provider | `class MyModel extends BaseChatModel { ... }` for non-OpenAI APIs |
| Direct LangChain instantiation | `generateChatModelResponse(this, { model })` wraps in adapter + logWrapper |
| LangChain message types | Simple `Message` with roles: `system`, `human`, `ai`, `tool` |
| `tool_calls[].args` | `toolCalls[].arguments` |
