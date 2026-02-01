---
name: n8n-custom-nodes
description: Creates, debugs, tests, and maintains n8n custom nodes following best practices. Use when asked to build a new n8n node, fix a node bug, add operations to an existing node, create credentials, write node tests, or any task involving packages/nodes-base or custom node packages. Activate on keywords like "node", "trigger", "credential", "n8n", "workflow node", "custom node".
allowed-tools: Bash(*), Read, Write, Edit, Glob, Grep, Task, WebFetch, WebSearch
---

# n8n Custom Node Development Skill

Expert-level skill for creating, debugging, testing, and maintaining n8n custom nodes. Covers all node types (programmatic, declarative, trigger, webhook, polling), credentials, versioning, testing, and registration.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Core Interfaces & Types](#2-core-interfaces--types)
3. [Node Types & Patterns](#3-node-types--patterns)
4. [Credential Development](#4-credential-development)
5. [Node Parameters Reference](#5-node-parameters-reference)
6. [GenericFunctions Pattern](#6-genericfunctions-pattern)
7. [Versioning Strategy](#7-versioning-strategy)
8. [Node Registration](#8-node-registration)
9. [Testing Strategy](#9-testing-strategy)
10. [Debugging Guide](#10-debugging-guide)
11. [Complete Examples](#11-complete-examples)
12. [Common Pitfalls & Anti-Patterns](#12-common-pitfalls--anti-patterns)
13. [Scripts & Commands](#13-scripts--commands)

---

## 1. Project Structure

### Repository Layout

```
packages/
  nodes-base/                    # Built-in nodes package
    nodes/                       # Node implementations (306+ services)
      ServiceName/
        ServiceName.node.ts      # Main node (or VersionedNodeType wrapper)
        ServiceName.node.json    # Codex metadata (categories, docs links)
        ServiceName.svg          # Node icon (SVG format)
        ServiceNameTrigger.node.ts  # Trigger variant (optional)
        GenericFunctions.ts      # Shared API request helpers
        types.ts                 # TypeScript interfaces for API responses
        v1/                      # Version 1 implementation (if versioned)
          ServiceNameV1.node.ts
        v2/                      # Version 2 implementation (if versioned)
          ServiceNameV2.node.ts
          methods/               # loadOptions, listSearch, etc.
          transport/             # API request functions
          helpers/               # Utility functions
        descriptions/            # Separated property descriptions
          ResourceDescription.ts
          OperationDescription.ts
        test/                    # Tests directory
          ServiceName.node.test.ts
          workflow.json          # Workflow test definitions
    credentials/                 # Credential implementations
      ServiceNameApi.credentials.ts
      ServiceNameOAuth2Api.credentials.ts
    utils/                       # Shared utilities
      descriptions.ts            # Reusable parameter definitions
      binary.ts                  # Binary data helpers
      utilities.ts               # General helpers
    test/                        # Global test setup
      nodes/
        Helpers.ts               # Mock creation utilities
        TriggerHelpers.ts        # Trigger test utilities
    scripts/                     # Build & validation scripts
    package.json                 # Node/credential registration
  workflow/                      # Core interfaces and types
    src/
      interfaces.ts              # INodeType, INodeProperties, etc.
      versioned-node-type.ts     # VersionedNodeType class
  core/                          # Execution engine
    nodes-testing/               # Test harness utilities
      node-test-harness.ts       # NodeTestHarness class
      credentials-helper.ts      # Test credential management
```

### File Naming Conventions

| File Type | Convention | Example |
|-----------|-----------|---------|
| Node | `PascalCase.node.ts` | `Slack.node.ts` |
| Trigger Node | `PascalCaseTrigger.node.ts` | `SlackTrigger.node.ts` |
| Credential | `PascalCaseApi.credentials.ts` | `SlackApi.credentials.ts` |
| OAuth2 Credential | `PascalCaseOAuth2Api.credentials.ts` | `SlackOAuth2Api.credentials.ts` |
| Metadata | `PascalCase.node.json` | `Slack.node.json` |
| Icon | `lowercase.svg` | `slack.svg` |
| Generic Functions | `GenericFunctions.ts` | `GenericFunctions.ts` |
| Types | `types.ts` | `types.ts` |
| Tests | `PascalCase.node.test.ts` | `Slack.node.test.ts` |
| Workflow Tests | `workflow.json` or `descriptive-name.workflow.json` | `create-user.workflow.json` |
| Descriptions | `ResourceDescription.ts` | `MessageDescription.ts` |

---

## 2. Core Interfaces & Types

### INodeType - The Main Node Interface

Every node must implement `INodeType`:

```typescript
import type {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  ITriggerFunctions,
  IPollFunctions,
  IWebhookFunctions,
  IHookFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeListSearchResult,
  IWebhookResponseData,
  ITriggerResponse,
  IDataObject,
  NodeConnectionType,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class MyNode implements INodeType {
  description: INodeTypeDescription = { /* ... */ };

  // Regular execution (pick ONE execution method)
  async execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  async poll?(this: IPollFunctions): Promise<INodeExecutionData[][] | null>;
  async trigger?(this: ITriggerFunctions): Promise<ITriggerResponse | undefined>;
  async webhook?(this: IWebhookFunctions): Promise<IWebhookResponseData>;

  // Optional helper methods
  methods?: {
    loadOptions?: {
      [key: string]: (this: ILoadOptionsFunctions) => Promise<INodePropertyOptions[]>;
    };
    listSearch?: {
      [key: string]: (
        this: ILoadOptionsFunctions,
        filter?: string,
        paginationToken?: string,
      ) => Promise<INodeListSearchResult>;
    };
    credentialTest?: {
      [key: string]: (this: ILoadOptionsFunctions) => Promise<ICredentialTestResult>;
    };
    resourceMapping?: {
      [key: string]: (this: ILoadOptionsFunctions) => Promise<ResourceMapperFields>;
    };
  };

  // Webhook lifecycle management (for webhook triggers)
  webhookMethods?: {
    default: {
      checkExists(this: IHookFunctions): Promise<boolean>;
      create(this: IHookFunctions): Promise<boolean>;
      delete(this: IHookFunctions): Promise<boolean>;
    };
  };
}
```

### INodeTypeDescription

The description object defines everything about the node's UI and behavior:

```typescript
description: INodeTypeDescription = {
  // --- Required ---
  displayName: 'My Service',              // Human-readable name shown in UI
  name: 'myService',                       // Internal name (camelCase, unique)
  icon: 'file:myservice.svg',             // Icon reference
  group: ['transform'],                    // Node group: 'input'|'output'|'transform'|'trigger'
  version: 1,                              // Single version or array: [1, 2]
  description: 'Interact with My Service API',
  defaults: {
    name: 'My Service',                    // Default name when dropped on canvas
  },
  inputs: [NodeConnectionTypes.Main],      // Input connections
  outputs: [NodeConnectionTypes.Main],     // Output connections
  properties: [],                          // Node parameters (see section 5)

  // --- Optional ---
  subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
  credentials: [                           // Required credentials
    {
      name: 'myServiceApi',
      required: true,
      displayOptions: {                    // Conditional credential display
        show: { authentication: ['apiKey'] },
      },
    },
  ],
  defaultVersion: 2,                       // Default version when multiple exist
  polling: true,                           // For polling triggers
  usableAsTool: true,                      // Can be used as AI tool
  hidden: true,                            // Hide from node panel
  webhooks: [                              // For webhook triggers
    {
      name: 'default',
      httpMethod: 'POST',
      responseMode: 'onReceived',
      path: 'webhook',
    },
  ],
  requestDefaults: {                       // For declarative nodes
    baseURL: '={{$credentials.baseUrl}}',
    headers: { 'Content-Type': 'application/json' },
  },
  hints: [                                 // UI hints
    {
      type: 'info',
      message: 'Helpful information for users',
      whenToDisplay: 'beforeExecution',
      location: 'outputPane',
    },
  ],
  triggerPanel: {                          // Trigger node panel config
    header: 'Listening for events',
    executionsHelp: {
      inactive: 'Activate the workflow to start listening.',
      active: 'The trigger is now active and listening.',
    },
  },
};
```

### INodeExecutionData

The data structure flowing between nodes:

```typescript
interface INodeExecutionData {
  json: IDataObject;            // The main JSON data (required)
  binary?: IBinaryKeyData;      // Binary attachments (optional)
  pairedItem?: IPairedItemData; // Links output to input items
  error?: NodeApiError;         // Error information
}

// Example output from execute():
return [
  // Each array element = one output connector
  [
    // Each item in the array = one data item
    { json: { id: 1, name: 'Item 1' }, pairedItem: { item: 0 } },
    { json: { id: 2, name: 'Item 2' }, pairedItem: { item: 1 } },
  ],
];
```

### NodeConnectionTypes

```typescript
import { NodeConnectionTypes } from 'n8n-workflow';

// Standard data flow
NodeConnectionTypes.Main     // 'main' - standard data connection

// AI/LangChain connections
NodeConnectionTypes.AiAgent
NodeConnectionTypes.AiChain
NodeConnectionTypes.AiLanguageModel
NodeConnectionTypes.AiMemory
NodeConnectionTypes.AiTool
NodeConnectionTypes.AiVectorStore
NodeConnectionTypes.AiEmbedding
NodeConnectionTypes.AiDocument
NodeConnectionTypes.AiOutputParser
NodeConnectionTypes.AiRetriever
NodeConnectionTypes.AiTextSplitter
```

---

## 3. Node Types & Patterns

### 3a. Programmatic Node (execute method)

The most common pattern. Processes input items and returns output items.

```typescript
import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class MyService implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Service',
    name: 'myService',
    icon: 'file:myservice.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with My Service API',
    defaults: { name: 'My Service' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [
      {
        name: 'myServiceApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'User', value: 'user' },
          { name: 'Project', value: 'project' },
        ],
        default: 'user',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['user'] },
        },
        options: [
          { name: 'Create', value: 'create', action: 'Create a user' },
          { name: 'Delete', value: 'delete', action: 'Delete a user' },
          { name: 'Get', value: 'get', action: 'Get a user' },
          { name: 'Get Many', value: 'getAll', action: 'Get many users' },
          { name: 'Update', value: 'update', action: 'Update a user' },
        ],
        default: 'create',
      },
      // ... additional parameter definitions
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    const credentials = await this.getCredentials('myServiceApi');

    for (let i = 0; i < items.length; i++) {
      try {
        if (resource === 'user') {
          if (operation === 'create') {
            const name = this.getNodeParameter('name', i) as string;
            const email = this.getNodeParameter('email', i) as string;

            const body: IDataObject = { name, email };

            // Add optional fields
            const additionalFields = this.getNodeParameter(
              'additionalFields', i, {},
            ) as IDataObject;
            Object.assign(body, additionalFields);

            const response = await myServiceApiRequest.call(
              this, 'POST', '/users', body,
            );

            returnData.push({
              json: response as IDataObject,
              pairedItem: { item: i },
            });
          }

          if (operation === 'get') {
            const userId = this.getNodeParameter('userId', i) as string;
            const response = await myServiceApiRequest.call(
              this, 'GET', `/users/${userId}`,
            );

            returnData.push({
              json: response as IDataObject,
              pairedItem: { item: i },
            });
          }

          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;
            const limit = this.getNodeParameter('limit', i, 50) as number;

            let response: IDataObject[];
            if (returnAll) {
              response = await myServiceApiRequestAllItems.call(
                this, 'data', 'GET', '/users',
              );
            } else {
              response = await myServiceApiRequest.call(
                this, 'GET', '/users', {}, { limit },
              ) as IDataObject[];
            }

            const executionData = this.helpers.constructExecutionMetaData(
              this.helpers.returnJsonArray(response),
              { itemData: { item: i } },
            );
            returnData.push(...executionData);
          }

          if (operation === 'delete') {
            const userId = this.getNodeParameter('userId', i) as string;
            await myServiceApiRequest.call(this, 'DELETE', `/users/${userId}`);
            returnData.push({
              json: { success: true },
              pairedItem: { item: i },
            });
          }
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
```

### 3b. Declarative Node (routing-based, no execute method)

Uses `requestDefaults` and `routing` on properties instead of writing `execute()`:

```typescript
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class MyDeclarativeNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Declarative Service',
    name: 'myDeclarativeService',
    icon: 'file:myservice.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Use the My Service API',
    defaults: { name: 'My Declarative Service' },
    usableAsTool: true,
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      { name: 'myServiceApi', required: true },
    ],
    requestDefaults: {
      returnFullResponse: true,
      baseURL: '={{$credentials.url.replace(new RegExp("/$"), "")}}',
      headers: {},
    },
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'User', value: 'user' },
        ],
        default: 'user',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['user'] } },
        options: [
          {
            name: 'Get',
            value: 'get',
            action: 'Get a user',
            routing: {
              request: {
                method: 'GET',
                url: '=/api/v1/users/{{$parameter.userId}}',
              },
            },
          },
          {
            name: 'Get Many',
            value: 'getAll',
            action: 'Get many users',
            routing: {
              request: {
                method: 'GET',
                url: '/api/v1/users',
              },
              send: {
                paginate: true,
              },
              output: {
                postReceive: [
                  {
                    type: 'rootProperty',
                    properties: { property: 'data' },
                  },
                ],
              },
            },
          },
          {
            name: 'Create',
            value: 'create',
            action: 'Create a user',
            routing: {
              request: {
                method: 'POST',
                url: '/api/v1/users',
              },
              send: {
                type: 'body',
                property: 'profile',
              },
            },
          },
        ],
        default: 'get',
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: { resource: ['user'], operation: ['get'] },
        },
      },
    ],
  };
}
```

### 3c. Webhook Trigger Node

Receives real-time events via HTTP webhooks:

```typescript
import type {
  IHookFunctions,
  IWebhookFunctions,
  IWebhookResponseData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  INodeExecutionData,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

export class MyServiceTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Service Trigger',
    name: 'myServiceTrigger',
    icon: 'file:myservice.svg',
    group: ['trigger'],
    version: 1,
    description: 'Starts the workflow on My Service events',
    defaults: { name: 'My Service Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      { name: 'myServiceApi', required: true },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        required: true,
        default: 'itemCreated',
        options: [
          { name: 'Item Created', value: 'itemCreated' },
          { name: 'Item Updated', value: 'itemUpdated' },
          { name: 'Item Deleted', value: 'itemDeleted' },
        ],
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default');
        const webhookData = this.getWorkflowStaticData('node');
        const event = this.getNodeParameter('event', 0) as string;
        const credentials = await this.getCredentials('myServiceApi');

        // Check if webhook already exists on the remote service
        try {
          const existingWebhooks = await myServiceApiRequest.call(
            this, 'GET', '/webhooks',
          ) as IDataObject[];

          const existing = existingWebhooks.find(
            (wh) => wh.url === webhookUrl && wh.event === event,
          );

          if (existing) {
            webhookData.webhookId = existing.id;
            return true;
          }
        } catch {
          // If check fails, assume it doesn't exist
        }

        return false;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default');
        const webhookData = this.getWorkflowStaticData('node');
        const event = this.getNodeParameter('event', 0) as string;

        const body: IDataObject = {
          url: webhookUrl,
          event,
        };

        const response = await myServiceApiRequest.call(
          this, 'POST', '/webhooks', body,
        ) as IDataObject;

        webhookData.webhookId = response.id;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        const webhookId = webhookData.webhookId as string;

        if (!webhookId) return false;

        try {
          await myServiceApiRequest.call(
            this, 'DELETE', `/webhooks/${webhookId}`,
          );
        } catch (error) {
          // If webhook already deleted, that's fine
          const statusCode = (error as IDataObject).httpStatusCode;
          if (statusCode !== 404) throw error;
        }

        delete webhookData.webhookId;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();
    const body = this.getBodyData();

    // Handle validation requests from the service
    if (req.query.challenge) {
      const res = this.getResponseObject();
      res.status(200).json({ challenge: req.query.challenge });
      return { noWebhookResponse: true };
    }

    // Process the webhook payload
    const events = Array.isArray(body.events) ? body.events : [body];

    return {
      workflowData: [
        events.map((event: IDataObject) => ({
          json: event,
        })),
      ],
    };
  }
}
```

### 3d. Polling Trigger Node

Periodically polls an API for new data:

```typescript
import type {
  IPollFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class MyServiceTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Service Trigger',
    name: 'myServiceTrigger',
    icon: 'file:myservice.svg',
    group: ['trigger'],
    version: 1,
    description: 'Polls My Service for new items',
    defaults: { name: 'My Service Trigger' },
    polling: true,              // <-- This makes it a polling trigger
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      { name: 'myServiceApi', required: true },
    ],
    properties: [
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        default: 'newItem',
        options: [
          { name: 'New Item', value: 'newItem' },
          { name: 'Updated Item', value: 'updatedItem' },
        ],
      },
    ],
  };

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const webhookData = this.getWorkflowStaticData('node') as {
      lastTimestamp?: string;
    };

    const event = this.getNodeParameter('event') as string;
    const now = new Date().toISOString();

    // For manual testing, just return latest items
    if (this.getMode() === 'manual') {
      const items = await myServiceApiRequest.call(
        this, 'GET', '/items', {}, { limit: 1 },
      ) as IDataObject[];

      if (!items.length) return null;
      return [this.helpers.returnJsonArray(items)];
    }

    // Use last timestamp to only get new items
    const since = webhookData.lastTimestamp ?? now;
    const qs: IDataObject = { since, event };

    const items = await myServiceApiRequest.call(
      this, 'GET', '/items', {}, qs,
    ) as IDataObject[];

    // Update the timestamp for next poll
    webhookData.lastTimestamp = now;

    if (!items.length) return null;
    return [this.helpers.returnJsonArray(items)];
  }
}
```

### 3e. Generic Trigger Node (event-based)

Listens for events using an external library or protocol:

```typescript
import type {
  ITriggerFunctions,
  ITriggerResponse,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class MqttTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'MQTT Trigger',
    name: 'mqttTrigger',
    icon: 'file:mqtt.svg',
    group: ['trigger'],
    version: 1,
    description: 'Listens for MQTT messages',
    defaults: { name: 'MQTT Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      { name: 'mqtt', required: true },
    ],
    properties: [
      {
        displayName: 'Topic',
        name: 'topic',
        type: 'string',
        required: true,
        default: '',
        description: 'MQTT topic to subscribe to',
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const topic = this.getNodeParameter('topic') as string;
    const credentials = await this.getCredentials('mqtt');

    // Connect to external service
    const client = await connectToMqtt(credentials);

    // Subscribe and emit data when messages arrive
    client.subscribe(topic);
    client.on('message', (receivedTopic: string, message: Buffer) => {
      this.emit([
        this.helpers.returnJsonArray([
          {
            topic: receivedTopic,
            message: message.toString(),
            timestamp: new Date().toISOString(),
          },
        ]),
      ]);
    });

    // Return cleanup function and manual trigger
    return {
      closeFunction: async () => {
        client.unsubscribe(topic);
        await client.end();
      },
      manualTriggerFunction: async () => {
        // For manual testing - emit a sample event
        this.emit([
          this.helpers.returnJsonArray([
            { topic, message: 'Manual trigger', timestamp: new Date().toISOString() },
          ]),
        ]);
      },
    };
  }
}
```

### 3f. Cron/Schedule Trigger Node

Uses n8n's built-in cron scheduling:

```typescript
import type {
  ITriggerFunctions,
  ITriggerResponse,
  INodeType,
  INodeTypeDescription,
  TriggerTime,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeHelpers, toCronExpression } from 'n8n-workflow';

export class ScheduleTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Schedule Trigger',
    name: 'scheduleTrigger',
    icon: 'fa:clock',
    group: ['trigger', 'schedule'],
    version: 1,
    description: 'Triggers on a schedule',
    defaults: { name: 'Schedule Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName: 'Trigger Times',
        name: 'triggerTimes',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
          multipleValueButtonText: 'Add Time',
        },
        default: {},
        options: NodeHelpers.cronNodeOptions,
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const triggerTimes = this.getNodeParameter('triggerTimes') as {
      item: TriggerTime[];
    };

    const expressions = (triggerTimes.item || []).map(toCronExpression);

    const executeTrigger = () => {
      this.emit([this.helpers.returnJsonArray([{}])]);
    };

    expressions.forEach((expression) =>
      this.helpers.registerCron({ expression }, executeTrigger),
    );

    return {
      manualTriggerFunction: async () => executeTrigger(),
    };
  }
}
```

---

## 4. Credential Development

### Simple API Key Credential

```typescript
import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class MyServiceApi implements ICredentialType {
  name = 'myServiceApi';
  displayName = 'My Service API';
  documentationUrl = 'myService'; // maps to n8n docs URL
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.myservice.com',
      required: true,
    },
  ];

  // How the credential authenticates requests
  authenticate = {
    type: 'generic' as const,
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  // Test request to validate credentials
  test = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/api/v1/me',
    },
  };
}
```

### OAuth2 Credential

```typescript
import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class MyServiceOAuth2Api implements ICredentialType {
  name = 'myServiceOAuth2Api';
  displayName = 'My Service OAuth2 API';
  documentationUrl = 'myService';
  extends = ['oAuth2Api'];  // Extends base OAuth2
  properties: INodeProperties[] = [
    {
      displayName: 'Grant Type',
      name: 'grantType',
      type: 'hidden',
      default: 'authorizationCode',
    },
    {
      displayName: 'Authorization URL',
      name: 'authUrl',
      type: 'hidden',
      default: 'https://myservice.com/oauth/authorize',
    },
    {
      displayName: 'Access Token URL',
      name: 'accessTokenUrl',
      type: 'hidden',
      default: 'https://myservice.com/oauth/token',
    },
    {
      displayName: 'Scope',
      name: 'scope',
      type: 'hidden',
      default: 'read write',
    },
    {
      displayName: 'Auth URI Query Parameters',
      name: 'authQueryParameters',
      type: 'hidden',
      default: '',
    },
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'hidden',
      default: 'header',
    },
  ];
}
```

### Header-Based Auth Credential

```typescript
import type {
  IAuthenticateGeneric,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class MyServiceHeaderApi implements ICredentialType {
  name = 'myServiceHeaderApi';
  displayName = 'My Service Header Auth';
  properties: INodeProperties[] = [
    {
      displayName: 'API Token',
      name: 'token',
      type: 'string',
      typeOptions: { password: true },
      default: '',
    },
    {
      displayName: 'Subdomain',
      name: 'subdomain',
      type: 'string',
      default: '',
      placeholder: 'mycompany',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'X-API-Key': '={{$credentials.token}}',
      },
    },
  };

  test = {
    request: {
      baseURL: '=https://{{$credentials.subdomain}}.myservice.com/api',
      url: '/v1/verify',
    },
  };
}
```

### Credential with Custom Test Method

For credentials that need programmatic testing:

```typescript
// In the credential file:
export class MyServiceApi implements ICredentialType {
  name = 'myServiceApi';
  displayName = 'My Service API';
  properties: INodeProperties[] = [/* ... */];

  // Reference the test method by name
  test = {
    credentialTest: 'myServiceApiTest',
  };
}

// In the node file, add to methods:
methods = {
  credentialTest: {
    async myServiceApiTest(
      this: ILoadOptionsFunctions,
    ): Promise<{ status: string; message?: string }> {
      try {
        await myServiceApiRequest.call(this, 'GET', '/me');
        return { status: 'OK', message: 'Connection successful!' };
      } catch (error) {
        return {
          status: 'Error',
          message: `Connection failed: ${(error as Error).message}`,
        };
      }
    },
  },
};
```

---

## 5. Node Parameters Reference

### Parameter Types

```typescript
type NodePropertyTypes =
  | 'string'              // Text input
  | 'number'              // Numeric input
  | 'boolean'             // Toggle switch
  | 'options'             // Dropdown select
  | 'multiOptions'        // Multi-select dropdown
  | 'collection'          // Optional key-value pairs (Additional Fields)
  | 'fixedCollection'     // Structured collections
  | 'json'                // JSON editor
  | 'color'               // Color picker
  | 'dateTime'            // Date/time picker
  | 'resourceLocator'     // Flexible resource selector (list/ID/URL)
  | 'resourceMapper'      // Maps fields to external resource
  | 'filter'              // Filter conditions builder
  | 'assignmentCollection' // Field assignment UI
  | 'notice'              // Read-only info notice
  | 'button'              // Clickable button
  | 'hidden'              // Hidden value
  | 'credentials'         // Credential selector
  | 'workflowSelector';   // Workflow picker
```

### Common Parameter Patterns

#### Resource + Operation Pattern (standard for service nodes)

```typescript
properties: [
  {
    displayName: 'Resource',
    name: 'resource',
    type: 'options',
    noDataExpression: true,
    options: [
      { name: 'Contact', value: 'contact' },
      { name: 'Deal', value: 'deal' },
      { name: 'Task', value: 'task' },
    ],
    default: 'contact',
  },
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['contact'] },
    },
    options: [
      {
        name: 'Create',
        value: 'create',
        description: 'Create a new contact',
        action: 'Create a contact',    // Used for AI tool descriptions
      },
      {
        name: 'Delete',
        value: 'delete',
        description: 'Delete a contact',
        action: 'Delete a contact',
      },
      {
        name: 'Get',
        value: 'get',
        description: 'Retrieve a contact',
        action: 'Get a contact',
      },
      {
        name: 'Get Many',
        value: 'getAll',
        description: 'Retrieve multiple contacts',
        action: 'Get many contacts',
      },
      {
        name: 'Update',
        value: 'update',
        description: 'Update a contact',
        action: 'Update a contact',
      },
    ],
    default: 'create',
  },
],
```

#### Additional Fields Collection

```typescript
{
  displayName: 'Additional Fields',
  name: 'additionalFields',
  type: 'collection',
  placeholder: 'Add Field',
  default: {},
  displayOptions: {
    show: { resource: ['contact'], operation: ['create', 'update'] },
  },
  options: [
    {
      displayName: 'Company',
      name: 'company',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Phone',
      name: 'phone',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Tags',
      name: 'tags',
      type: 'multiOptions',
      options: [
        { name: 'VIP', value: 'vip' },
        { name: 'Lead', value: 'lead' },
      ],
      default: [],
    },
  ],
}
```

#### Return All or Limit Pattern

Use the shared utility from `utils/descriptions.ts`:

```typescript
import { returnAllOrLimit } from '@utils/descriptions';

// In properties array:
...returnAllOrLimit,
```

This adds:
```typescript
[
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1 },
    displayOptions: { show: { returnAll: [false] } },
  },
]
```

#### Resource Locator

```typescript
{
  displayName: 'Team',
  name: 'teamId',
  type: 'resourceLocator',
  default: { mode: 'list', value: '' },
  required: true,
  description: 'Select a team from the list, by ID, or by URL',
  modes: [
    {
      displayName: 'From List',
      name: 'list',
      type: 'list',
      placeholder: 'Select a team...',
      typeOptions: {
        searchListMethod: 'getTeams',
        searchable: true,
      },
    },
    {
      displayName: 'By ID',
      name: 'id',
      type: 'string',
      placeholder: 'e.g., team-123',
    },
    {
      displayName: 'By URL',
      name: 'url',
      type: 'string',
      placeholder: 'e.g., https://myservice.com/teams/team-123',
      extractValue: {
        type: 'regex',
        regex: /teams\/([a-zA-Z0-9-]+)/,
      },
    },
  ],
}
```

#### Dynamic Options (loadOptions)

```typescript
// In properties:
{
  displayName: 'Project Name or ID',
  name: 'projectId',
  type: 'options',
  typeOptions: {
    loadOptionsMethod: 'getProjects',
  },
  default: '',
  description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
}

// In methods:
methods = {
  loadOptions: {
    async getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      const response = await myServiceApiRequest.call(
        this, 'GET', '/projects',
      ) as Array<{ id: string; name: string }>;

      return response.map((project) => ({
        name: project.name,
        value: project.id,
      }));
    },
  },
};
```

#### Dynamic List Search (searchable with pagination)

```typescript
// In properties (with resourceLocator):
{
  displayName: 'User',
  name: 'userId',
  type: 'resourceLocator',
  default: { mode: 'list', value: '' },
  modes: [
    {
      displayName: 'From List',
      name: 'list',
      type: 'list',
      typeOptions: {
        searchListMethod: 'searchUsers',
        searchable: true,
      },
    },
    // ...
  ],
}

// In methods:
methods = {
  listSearch: {
    async searchUsers(
      this: ILoadOptionsFunctions,
      filter?: string,
      paginationToken?: string,
    ): Promise<INodeListSearchResult> {
      const qs: IDataObject = { limit: 20 };
      if (filter) qs.search = filter;
      if (paginationToken) qs.cursor = paginationToken;

      const response = await myServiceApiRequest.call(
        this, 'GET', '/users', {}, qs,
      );

      return {
        results: response.data.map((user: IDataObject) => ({
          name: user.name as string,
          value: user.id as string,
          url: `https://myservice.com/users/${user.id}`,
        })),
        paginationToken: response.nextCursor || undefined,
      };
    },
  },
};
```

#### Display Options (Conditional Visibility)

```typescript
{
  displayName: 'Email',
  name: 'email',
  type: 'string',
  default: '',
  required: true,
  displayOptions: {
    show: {
      resource: ['contact'],
      operation: ['create'],
    },
  },
}

// Multiple conditions (OR within same key, AND between keys):
displayOptions: {
  show: {
    resource: ['contact', 'lead'],    // show if resource is contact OR lead
    operation: ['create'],            // AND operation is create
  },
  hide: {
    useCustom: [true],               // hide if useCustom is true
  },
}
```

#### Fixed Collection (Structured Data)

```typescript
{
  displayName: 'Fields to Set',
  name: 'fieldsToSet',
  type: 'fixedCollection',
  typeOptions: {
    multipleValues: true,
    multipleValueButtonText: 'Add Field',
  },
  default: {},
  options: [
    {
      name: 'values',
      displayName: 'Values',
      values: [
        {
          displayName: 'Field Name',
          name: 'fieldName',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Field Value',
          name: 'fieldValue',
          type: 'string',
          default: '',
        },
      ],
    },
  ],
}
```

---

## 6. GenericFunctions Pattern

Every service node should have a `GenericFunctions.ts` file with reusable API helpers:

```typescript
import type {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestMethods,
  ILoadOptionsFunctions,
  IPollFunctions,
  IRequestOptions,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/**
 * Make an authenticated API request to My Service.
 */
export async function myServiceApiRequest(
  this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IPollFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject = {},
  qs: IDataObject = {},
  option: IDataObject = {},
): Promise<IDataObject | IDataObject[]> {
  const credentials = await this.getCredentials('myServiceApi');

  const options: IRequestOptions = {
    method,
    body,
    qs,
    uri: `${credentials.baseUrl}/api/v1${endpoint}`,
    json: true,
    ...option,
  };

  // Don't send empty body on GET/DELETE
  if (method === 'GET' || method === 'DELETE') {
    delete options.body;
  }

  // Remove empty query string
  if (!Object.keys(qs).length) {
    delete options.qs;
  }

  try {
    const response = await this.helpers.requestWithAuthentication.call(
      this, 'myServiceApi', options,
    );
    return response as IDataObject;
  } catch (error) {
    throw new NodeApiError(this.getNode(), error as JsonObject, {
      message: (error as JsonObject).message as string,
    });
  }
}

/**
 * Fetch all items with automatic pagination.
 */
export async function myServiceApiRequestAllItems(
  this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IPollFunctions,
  propertyName: string,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject = {},
  qs: IDataObject = {},
): Promise<IDataObject[]> {
  const returnData: IDataObject[] = [];

  let responseData: IDataObject;
  qs.limit = 100;
  qs.offset = 0;

  do {
    responseData = await myServiceApiRequest.call(
      this, method, endpoint, body, qs,
    ) as IDataObject;

    const items = responseData[propertyName] as IDataObject[];
    returnData.push(...items);

    qs.offset = (qs.offset as number) + (qs.limit as number);
  } while (
    (responseData[propertyName] as IDataObject[]).length === qs.limit
  );

  return returnData;
}

/**
 * Cursor-based pagination variant.
 */
export async function myServiceApiRequestAllItemsCursor(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  propertyName: string,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject = {},
  qs: IDataObject = {},
): Promise<IDataObject[]> {
  const returnData: IDataObject[] = [];
  let cursor: string | undefined;

  do {
    if (cursor) qs.cursor = cursor;

    const responseData = await myServiceApiRequest.call(
      this, method, endpoint, body, qs,
    ) as IDataObject;

    const items = responseData[propertyName] as IDataObject[];
    returnData.push(...items);

    cursor = responseData.next_cursor as string | undefined;
  } while (cursor);

  return returnData;
}
```

---

## 7. Versioning Strategy

### Light Versioning (version arrays)

For minor changes within the same class:

```typescript
export class MyNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Node',
    name: 'myNode',
    version: [1, 1.1, 1.2],   // Multiple versions, same class
    // ...
    properties: [
      {
        displayName: 'New Feature',
        name: 'newFeature',
        type: 'boolean',
        default: false,
        // Only show in v1.1+
        displayOptions: {
          show: { '@version': [{ _cnd: { gte: 1.1 } }] },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const nodeVersion = this.getNode().typeVersion;

    if (nodeVersion >= 1.1) {
      // New behavior for v1.1+
    } else {
      // Original v1 behavior
    }

    return [returnData];
  }
}
```

### Full Versioning (VersionedNodeType)

For major changes that need separate implementations:

```typescript
// MyService.node.ts (wrapper)
import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { MyServiceV1 } from './v1/MyServiceV1.node';
import { MyServiceV2 } from './v2/MyServiceV2.node';

export class MyService extends VersionedNodeType {
  constructor() {
    const baseDescription: INodeTypeBaseDescription = {
      displayName: 'My Service',
      name: 'myService',
      icon: 'file:myservice.svg',
      group: ['transform'],
      description: 'Interact with My Service',
      defaultVersion: 2,       // New workflows get v2
    };

    const nodeVersions: IVersionedNodeType['nodeVersions'] = {
      1: new MyServiceV1(baseDescription),
      2: new MyServiceV2(baseDescription),
      2.1: new MyServiceV2(baseDescription),
    };

    super(nodeVersions, baseDescription);
  }
}

// v1/MyServiceV1.node.ts
import type {
  INodeTypeBaseDescription,
  INodeTypeDescription,
  INodeType,
} from 'n8n-workflow';

export class MyServiceV1 implements INodeType {
  description: INodeTypeDescription;

  constructor(baseDescription: INodeTypeBaseDescription) {
    this.description = {
      ...baseDescription,
      version: 1,
      defaults: { name: 'My Service' },
      inputs: ['main'],
      outputs: ['main'],
      properties: [/* v1 properties */],
    };
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // V1 implementation
  }
}
```

---

## 8. Node Registration

### package.json Registration

After creating a node, register it in `packages/nodes-base/package.json`:

```json
{
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/MyServiceApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/MyService/MyService.node.js"
    ]
  }
}
```

### Node Metadata File (.node.json)

Create a codex metadata file for discoverability:

```json
{
  "node": "n8n-nodes-base.myService",
  "nodeVersion": "1.0",
  "codexVersion": "1.0",
  "categories": ["Marketing", "Communication"],
  "subcategories": {},
  "alias": ["api", "webhook", "automation"],
  "resources": {
    "credentialDocumentation": [
      {
        "url": "https://docs.n8n.io/integrations/builtin/credentials/myservice/"
      }
    ],
    "primaryDocumentation": [
      {
        "url": "https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.myservice/"
      }
    ]
  }
}
```

### Categories Reference

Valid categories for `.node.json`:
- `Analytics`
- `Communication`
- `Core Nodes`
- `Data & Storage`
- `Development`
- `Finance & Accounting`
- `HITL` (Human in the Loop)
- `Marketing`
- `Miscellaneous`
- `Productivity`
- `Sales`
- `Utility`

---

## 9. Testing Strategy

### 9a. Unit Tests with Mocks

Standard unit tests mock `IExecuteFunctions` and test node logic:

```typescript
import { mock, mockDeep } from 'jest-mock-extended';
import type { IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MyService } from '../MyService.node';
import * as GenericFunctions from '../GenericFunctions';

describe('MyService Node', () => {
  let node: MyService;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
  const apiRequestSpy = jest.spyOn(GenericFunctions, 'myServiceApiRequest');

  beforeEach(() => {
    node = new MyService();
    mockExecuteFunctions = mockDeep<IExecuteFunctions>();
    jest.clearAllMocks();

    // Default setup
    mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
    mockExecuteFunctions.getNode.mockReturnValue(
      mock<INode>({
        id: 'test',
        name: 'Test Node',
        type: 'n8n-nodes-base.myService',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      }),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('User Resource', () => {
    describe('Create Operation', () => {
      it('should create a user successfully', async () => {
        mockExecuteFunctions.getNodeParameter
          .mockReturnValueOnce('user')         // resource
          .mockReturnValueOnce('create')       // operation
          .mockReturnValueOnce('John Doe')     // name
          .mockReturnValueOnce('john@test.com') // email
          .mockReturnValueOnce({});            // additionalFields

        apiRequestSpy.mockResolvedValue({
          id: '123',
          name: 'John Doe',
          email: 'john@test.com',
        });

        const result = await node.execute.call(mockExecuteFunctions);

        expect(result[0]).toHaveLength(1);
        expect(result[0][0].json).toEqual({
          id: '123',
          name: 'John Doe',
          email: 'john@test.com',
        });
        expect(apiRequestSpy).toHaveBeenCalledWith(
          'POST', '/users', { name: 'John Doe', email: 'john@test.com' },
        );
      });

      it('should handle API errors with continueOnFail', async () => {
        mockExecuteFunctions.getNodeParameter
          .mockReturnValueOnce('user')
          .mockReturnValueOnce('create')
          .mockReturnValueOnce('Test')
          .mockReturnValueOnce('test@test.com')
          .mockReturnValueOnce({});

        mockExecuteFunctions.continueOnFail.mockReturnValue(true);
        apiRequestSpy.mockRejectedValue(new Error('API Error'));

        const result = await node.execute.call(mockExecuteFunctions);

        expect(result[0][0].json).toHaveProperty('error', 'API Error');
      });

      it('should throw on API error without continueOnFail', async () => {
        mockExecuteFunctions.getNodeParameter
          .mockReturnValueOnce('user')
          .mockReturnValueOnce('create')
          .mockReturnValueOnce('Test')
          .mockReturnValueOnce('test@test.com')
          .mockReturnValueOnce({});

        mockExecuteFunctions.continueOnFail.mockReturnValue(false);
        apiRequestSpy.mockRejectedValue(new Error('API Error'));

        await expect(
          node.execute.call(mockExecuteFunctions),
        ).rejects.toThrow('API Error');
      });
    });

    describe('Get Many Operation', () => {
      it('should return all items when returnAll is true', async () => {
        mockExecuteFunctions.getNodeParameter
          .mockReturnValueOnce('user')
          .mockReturnValueOnce('getAll')
          .mockReturnValueOnce(true);  // returnAll

        const mockResponse = [
          { id: '1', name: 'User 1' },
          { id: '2', name: 'User 2' },
        ];

        jest.spyOn(GenericFunctions, 'myServiceApiRequestAllItems')
          .mockResolvedValue(mockResponse);

        mockExecuteFunctions.helpers.constructExecutionMetaData
          .mockImplementation((items) => items as any);
        mockExecuteFunctions.helpers.returnJsonArray
          .mockReturnValue(mockResponse.map((item) => ({ json: item })) as any);

        const result = await node.execute.call(mockExecuteFunctions);

        expect(result[0]).toHaveLength(2);
      });
    });
  });
});
```

### 9b. Trigger Node Tests

Use the helpers from `test/nodes/TriggerHelpers.ts`:

```typescript
import {
  testTriggerNode,
  testWebhookTriggerNode,
  testPollingTriggerNode,
} from '@test/nodes/TriggerHelpers';
import { MyServiceTrigger } from '../MyServiceTrigger.node';

describe('MyService Trigger', () => {
  // Generic trigger test
  describe('trigger mode', () => {
    it('should emit data on event', async () => {
      const { emit, close } = await testTriggerNode(MyServiceTrigger, {
        node: { parameters: { topic: 'test-topic' } },
        credential: { apiKey: 'test-key', host: 'localhost' },
      });

      // Verify emit was called
      expect(emit).toHaveBeenCalled();
      await close();
    });

    it('should return manual trigger function', async () => {
      const { manualTriggerFunction } = await testTriggerNode(MyServiceTrigger, {
        mode: 'manual',
        node: { parameters: { topic: 'test-topic' } },
      });

      expect(manualTriggerFunction).toBeInstanceOf(Function);
    });
  });

  // Webhook trigger test
  describe('webhook mode', () => {
    it('should process webhook payload', async () => {
      const { responseData } = await testWebhookTriggerNode(MyServiceTrigger, {
        bodyData: { event: 'item.created', data: { id: '123' } },
        node: { parameters: { event: 'itemCreated' } },
      });

      expect(responseData?.workflowData).toBeDefined();
    });
  });

  // Polling trigger test
  describe('polling mode', () => {
    it('should return new items', async () => {
      nock('https://api.myservice.com')
        .get('/api/v1/items')
        .reply(200, [{ id: '1', name: 'New Item' }]);

      const { response } = await testPollingTriggerNode(MyServiceTrigger, {
        node: { parameters: { event: 'newItem' } },
        credential: { apiKey: 'test', baseUrl: 'https://api.myservice.com' },
      });

      expect(response).not.toBeNull();
      expect(response![0]).toHaveLength(1);
    });
  });
});
```

### 9c. Workflow Integration Tests with NodeTestHarness

Create a JSON workflow file and test it with NodeTestHarness:

```typescript
// test/MyService.node.test.ts
import { NodeTestHarness } from '@nodes-testing/node-test-harness';
import nock from 'nock';

describe('MyService Node', () => {
  const credentials = {
    myServiceApi: {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.myservice.com',
    },
  };

  describe('Create User', () => {
    beforeAll(() => {
      nock('https://api.myservice.com')
        .post('/api/v1/users', {
          name: 'John Doe',
          email: 'john@example.com',
        })
        .reply(201, {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          createdAt: '2024-01-01T00:00:00Z',
        });
    });

    new NodeTestHarness().setupTests({
      credentials,
      workflowFiles: ['create-user.workflow.json'],
    });
  });

  describe('List Users', () => {
    beforeAll(() => {
      nock('https://api.myservice.com')
        .get('/api/v1/users')
        .query({ limit: 50 })
        .reply(200, {
          data: [
            { id: '1', name: 'User 1' },
            { id: '2', name: 'User 2' },
          ],
        });
    });

    new NodeTestHarness().setupTests({
      credentials,
      workflowFiles: ['list-users.workflow.json'],
    });
  });
});
```

#### Workflow JSON for Test (test/create-user.workflow.json):

```json
{
  "name": "Create User Test",
  "nodes": [
    {
      "parameters": {},
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [0, 0],
      "id": "trigger-1",
      "name": "When clicking 'Execute Workflow'"
    },
    {
      "parameters": {
        "resource": "user",
        "operation": "create",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "type": "n8n-nodes-base.myService",
      "typeVersion": 1,
      "position": [200, 0],
      "id": "node-1",
      "name": "Create User",
      "credentials": {
        "myServiceApi": {
          "id": "cred-1",
          "name": "My Service API"
        }
      }
    }
  ],
  "pinData": {
    "Create User": [
      {
        "json": {
          "id": "123",
          "name": "John Doe",
          "email": "john@example.com",
          "createdAt": "2024-01-01T00:00:00Z"
        }
      }
    ]
  },
  "connections": {
    "When clicking 'Execute Workflow'": {
      "main": [
        [
          {
            "node": "Create User",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": false,
  "settings": {
    "executionOrder": "v1"
  }
}
```

### 9d. Running Tests

```bash
# Run specific test file
pushd packages/nodes-base && pnpm test MyService.node.test.ts && popd

# Run all tests in a node directory
pushd packages/nodes-base && pnpm test nodes/MyService/ && popd

# Run with coverage
pushd packages/nodes-base && pnpm test --coverage MyService && popd

# Run integration tests
pushd packages/nodes-base && pnpm vitest run --config vitest.integration.config.ts && popd
```

---

## 10. Debugging Guide

### Common Issues & Solutions

#### Issue: Node doesn't appear in the node panel
- Check `package.json` has the node registered under `n8n.nodes`
- Verify the dist path matches the actual file location
- Run `pnpm build` to regenerate metadata
- Check `.node.json` exists and has valid structure

#### Issue: Credentials not available in node
- Verify credential `name` matches what's referenced in `description.credentials`
- Check credential is registered in `package.json` under `n8n.credentials`
- Ensure `displayOptions` on credential entries match node parameters

#### Issue: Parameters not showing up
- Check `displayOptions` conditions - are they matching current selections?
- Verify parameter `name` is unique within its scope
- For nested params in collections, check parent is properly configured

#### Issue: API requests failing
- Check `credentials.authenticate` configuration
- Verify URL construction in GenericFunctions
- Use `this.helpers.requestWithAuthentication` for auto-auth
- Check for trailing slashes in base URLs

#### Issue: Binary data not working
- Use `this.helpers.prepareBinaryData()` to prepare binary data
- Use `this.helpers.assertBinaryData()` to validate binary exists
- Use `this.helpers.getBinaryDataBuffer()` to get buffer from binary

#### Issue: Test execution returns null
- Usually means workflow has misconfigured credentials
- Verify `credentials` object keys match credential type names exactly
- Check nock mocks match the actual URLs being called

### Debugging Techniques

```typescript
// Log within execute function
this.logger.info('Debug message', { data: someValue });
this.logger.error('Error occurred', { error });
this.logger.warn('Warning', { context: someContext });

// Inspect what parameters are available
const node = this.getNode();
console.log('Node parameters:', JSON.stringify(node.parameters, null, 2));
console.log('Node version:', node.typeVersion);

// Check execution mode
const mode = this.getMode(); // 'manual' | 'trigger' | 'webhook' etc.

// Inspect input data
const items = this.getInputData();
console.log('Input items:', JSON.stringify(items, null, 2));

// Check credentials (in tests)
const creds = await this.getCredentials('myServiceApi');
console.log('Credentials:', creds);
```

---

## 11. Complete Examples

### Complete Service Node with All Features

This shows a production-ready node with resource/operation pattern, dynamic options, pagination, error handling, and binary data support:

```typescript
// nodes/MyService/MyService.node.ts
import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { myServiceApiRequest, myServiceApiRequestAllItems } from './GenericFunctions';
import { contactFields, contactOperations } from './descriptions/ContactDescription';
import type { MyServiceResponse } from './types';

export class MyService implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Service',
    name: 'myService',
    icon: 'file:myservice.svg',
    group: ['transform'],
    version: [1, 1.1],
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with My Service API',
    defaults: { name: 'My Service' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [
      { name: 'myServiceApi', required: true },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Contact', value: 'contact' },
        ],
        default: 'contact',
      },
      ...contactOperations,
      ...contactFields,
    ],
  };

  methods = {
    loadOptions: {
      async getCustomFields(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const fields = await myServiceApiRequest.call(
          this, 'GET', '/custom-fields',
        ) as Array<{ id: string; label: string }>;

        return fields.map((field) => ({
          name: field.label,
          value: field.id,
        }));
      },
    },
    credentialTest: {
      async myServiceApiTest(
        this: ILoadOptionsFunctions,
      ) {
        try {
          await myServiceApiRequest.call(this, 'GET', '/me');
          return { status: 'OK' as const, message: 'Success' };
        } catch (error) {
          return {
            status: 'Error' as const,
            message: (error as Error).message,
          };
        }
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        if (resource === 'contact') {
          if (operation === 'create') {
            const email = this.getNodeParameter('email', i) as string;
            const additionalFields = this.getNodeParameter(
              'additionalFields', i, {},
            ) as IDataObject;

            const body: IDataObject = { email, ...additionalFields };

            const response = await myServiceApiRequest.call(
              this, 'POST', '/contacts', body,
            );

            returnData.push({
              json: response as IDataObject,
              pairedItem: { item: i },
            });
          }

          if (operation === 'get') {
            const contactId = this.getNodeParameter('contactId', i) as string;
            const response = await myServiceApiRequest.call(
              this, 'GET', `/contacts/${contactId}`,
            );

            returnData.push({
              json: response as IDataObject,
              pairedItem: { item: i },
            });
          }

          if (operation === 'getAll') {
            const returnAll = this.getNodeParameter('returnAll', i) as boolean;

            if (returnAll) {
              const items = await myServiceApiRequestAllItems.call(
                this, 'data', 'GET', '/contacts',
              );
              const executionData = this.helpers.constructExecutionMetaData(
                this.helpers.returnJsonArray(items),
                { itemData: { item: i } },
              );
              returnData.push(...executionData);
            } else {
              const limit = this.getNodeParameter('limit', i) as number;
              const response = await myServiceApiRequest.call(
                this, 'GET', '/contacts', {}, { limit },
              ) as IDataObject;

              const items = (response.data as IDataObject[]) || [];
              const executionData = this.helpers.constructExecutionMetaData(
                this.helpers.returnJsonArray(items),
                { itemData: { item: i } },
              );
              returnData.push(...executionData);
            }
          }

          if (operation === 'update') {
            const contactId = this.getNodeParameter('contactId', i) as string;
            const updateFields = this.getNodeParameter(
              'updateFields', i, {},
            ) as IDataObject;

            if (!Object.keys(updateFields).length) {
              throw new NodeOperationError(
                this.getNode(),
                'At least one update field must be set',
                { itemIndex: i },
              );
            }

            const response = await myServiceApiRequest.call(
              this, 'PATCH', `/contacts/${contactId}`, updateFields,
            );

            returnData.push({
              json: response as IDataObject,
              pairedItem: { item: i },
            });
          }

          if (operation === 'delete') {
            const contactId = this.getNodeParameter('contactId', i) as string;
            await myServiceApiRequest.call(
              this, 'DELETE', `/contacts/${contactId}`,
            );

            returnData.push({
              json: { success: true, id: contactId },
              pairedItem: { item: i },
            });
          }

          if (operation === 'uploadAvatar') {
            const contactId = this.getNodeParameter('contactId', i) as string;
            const binaryPropertyName = this.getNodeParameter(
              'binaryPropertyName', i,
            ) as string;

            const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
            const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

            const response = await myServiceApiRequest.call(
              this, 'POST', `/contacts/${contactId}/avatar`,
              {},
              {},
              {
                formData: {
                  file: {
                    value: buffer,
                    options: {
                      filename: binaryData.fileName || 'avatar',
                      contentType: binaryData.mimeType,
                    },
                  },
                },
              },
            );

            returnData.push({
              json: response as IDataObject,
              pairedItem: { item: i },
            });
          }
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
```

### Separated Description File Example

```typescript
// descriptions/ContactDescription.ts
import type { INodeProperties } from 'n8n-workflow';
import { returnAllOrLimit } from '@utils/descriptions';

export const contactOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: { resource: ['contact'] },
    },
    options: [
      {
        name: 'Create',
        value: 'create',
        action: 'Create a contact',
      },
      {
        name: 'Delete',
        value: 'delete',
        action: 'Delete a contact',
      },
      {
        name: 'Get',
        value: 'get',
        action: 'Get a contact',
      },
      {
        name: 'Get Many',
        value: 'getAll',
        action: 'Get many contacts',
      },
      {
        name: 'Update',
        value: 'update',
        action: 'Update a contact',
      },
      {
        name: 'Upload Avatar',
        value: 'uploadAvatar',
        action: 'Upload a contact avatar',
      },
    ],
    default: 'create',
  },
];

export const contactFields: INodeProperties[] = [
  // --- Create ---
  {
    displayName: 'Email',
    name: 'email',
    type: 'string',
    placeholder: 'name@email.com',
    required: true,
    default: '',
    displayOptions: {
      show: { resource: ['contact'], operation: ['create'] },
    },
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: { resource: ['contact'], operation: ['create'] },
    },
    options: [
      {
        displayName: 'First Name',
        name: 'firstName',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Last Name',
        name: 'lastName',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Phone',
        name: 'phone',
        type: 'string',
        default: '',
      },
    ],
  },

  // --- Get ---
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: { resource: ['contact'], operation: ['get', 'update', 'delete', 'uploadAvatar'] },
    },
  },

  // --- Get Many ---
  ...returnAllOrLimit.map((prop) => ({
    ...prop,
    displayOptions: {
      show: { resource: ['contact'], operation: ['getAll'] },
    },
  })),

  // --- Update ---
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: { resource: ['contact'], operation: ['update'] },
    },
    options: [
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        default: '',
      },
      {
        displayName: 'First Name',
        name: 'firstName',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Last Name',
        name: 'lastName',
        type: 'string',
        default: '',
      },
    ],
  },

  // --- Upload Avatar ---
  {
    displayName: 'Binary Property',
    name: 'binaryPropertyName',
    type: 'string',
    default: 'data',
    required: true,
    displayOptions: {
      show: { resource: ['contact'], operation: ['uploadAvatar'] },
    },
    description: 'Name of the binary property containing the file to upload',
  },
];
```

---

## 12. Common Pitfalls & Anti-Patterns

### TypeScript
- **NEVER use `any`** - use proper types or `unknown`
- **Avoid `as` type casting** - use type guards instead
- **Define interfaces** for all API responses in `types.ts`

### Error Handling
- **Use `NodeOperationError`** for user-facing errors (bad input, missing params)
- **Use `NodeApiError`** for API-related errors (wraps HTTP errors with context)
- **Always support `continueOnFail()`** in the execute loop
- **Include `itemIndex`** in NodeOperationError for per-item errors:
  ```typescript
  throw new NodeOperationError(this.getNode(), 'Missing required field', {
    itemIndex: i,
    description: 'The "name" field is required for the create operation',
  });
  ```
- **Do NOT use `ApplicationError`** - it's deprecated. Use `UnexpectedError`, `OperationalError`, or `UserError`

### Parameters
- **Always set `noDataExpression: true`** on resource and operation parameters
- **Use `action` field** on operation options for AI tool descriptions
- **Provide `description`** on all parameters for user guidance
- **Use `placeholder`** for string inputs to show example values
- **Use sensible `default` values** - never leave required fields without defaults

### Execution
- **Always include `pairedItem`** in output items to link output to input
- **Use `this.helpers.constructExecutionMetaData()`** for getAll operations
- **Use `this.helpers.returnJsonArray()`** to normalize arrays to INodeExecutionData format
- **Don't send empty body** on GET/DELETE requests
- **Handle pagination properly** - respect returnAll and limit parameters

### Testing
- **Mock ALL external dependencies** - no real API calls in unit tests
- **Use `nock`** for HTTP mocking, not custom interceptors
- **Test all operations** - happy path, error handling, edge cases
- **Always `jest.clearAllMocks()`** in beforeEach
- **Network connections are disabled** in test environment (via globalSetup)

### Icons
- Use **SVG format** for node icons
- Reference with `icon: 'file:myservice.svg'`
- For themed icons: `icon: { light: 'file:MyService.svg', dark: 'file:MyService.dark.svg' }`
- For Font Awesome: `icon: 'fa:icon-name'`

### Naming
- Node `name` must be **camelCase** and unique across all nodes
- Credential `name` must be **camelCase** and unique
- Internal names cannot be changed after release (breaking change)
- `displayName` can be changed freely

---

## 13. Scripts & Commands

### Development Commands

```bash
# Build all packages (redirect output)
pnpm build > build.log 2>&1
tail -n 20 build.log

# Build specific package
pushd packages/nodes-base && pnpm build && popd

# Run tests for specific node
pushd packages/nodes-base && pnpm test MyService.node.test && popd

# Run all tests
pushd packages/nodes-base && pnpm test && popd

# Type check
pushd packages/nodes-base && pnpm typecheck && popd

# Lint
pushd packages/nodes-base && pnpm lint && popd

# Lint with auto-fix
pushd packages/nodes-base && pnpm lint:fix && popd

# Format
pushd packages/nodes-base && pnpm format && popd

# Watch mode (rebuilds on changes)
pushd packages/nodes-base && pnpm watch && popd

# Start development server
pnpm dev

# Start with AI features
pnpm dev:ai
```

### Validation Scripts

```bash
# Validate loadOptions methods reference valid functions
pushd packages/nodes-base && node scripts/validate-load-options-methods.js && popd

# Validate schema versions
pushd packages/nodes-base && node scripts/validate-schema-versions.js && popd
```

### New Node Checklist

When creating a new node, verify:

1. [ ] Node file created: `nodes/ServiceName/ServiceName.node.ts`
2. [ ] Icon file created: `nodes/ServiceName/servicename.svg`
3. [ ] Metadata file created: `nodes/ServiceName/ServiceName.node.json`
4. [ ] Credential file created: `credentials/ServiceNameApi.credentials.ts`
5. [ ] GenericFunctions created: `nodes/ServiceName/GenericFunctions.ts`
6. [ ] Types file created (if needed): `nodes/ServiceName/types.ts`
7. [ ] Node registered in `package.json` under `n8n.nodes`
8. [ ] Credential registered in `package.json` under `n8n.credentials`
9. [ ] Tests written: `nodes/ServiceName/test/ServiceName.node.test.ts`
10. [ ] `pnpm typecheck` passes
11. [ ] `pnpm lint` passes
12. [ ] `pnpm test` passes
13. [ ] Node appears in node panel after build

### tsconfig Path Aliases

Available in nodes-base for imports:

```typescript
import { something } from '@credentials/MyService';      // credentials/
import { helper } from '@utils/descriptions';             // utils/
import { mockHelper } from '@test/nodes/Helpers';         // test/
import { NodeTestHarness } from '@nodes-testing/node-test-harness'; // core/nodes-testing/
```
