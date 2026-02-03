import type { RunningJobSummary } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { ExecutionsConfig } from '@n8n/config';
import { ExecutionRepository, WorkflowRepository } from '@n8n/db';
import { Service } from '@n8n/di';
import {
	WorkflowHasIssuesError,
	InstanceSettings,
	WorkflowExecute,
	SupplyDataContext,
	ExecutionLifecycleHooks,
} from 'n8n-core';
import type {
	CloseFunction,
	ExecutionStatus,
	IExecuteData,
	IExecuteResponsePromiseData,
	INodeExecutionData,
	IRun,
	ITaskDataConnections,
	IWorkflowExecutionDataProcess,
	StructuredChunk,
} from 'n8n-workflow';
import {
	BINARY_ENCODING,
	NodeConnectionTypes,
	Workflow,
	UnexpectedError,
	createRunExecutionData,
} from 'n8n-workflow';
import type PCancelable from 'p-cancelable';

import { EventService } from '@/events/event.service';
import { getLifecycleHooksForScalingWorker } from '@/execution-lifecycle/execution-lifecycle-hooks';
import { getWorkflowActiveStatusFromWorkflowData } from '@/executions/execution.utils';
import { ManualExecutionService } from '@/manual-execution.service';
import { NodeTypes } from '@/node-types';
import * as WorkflowExecuteAdditionalData from '@/workflow-execute-additional-data';

import type {
	Job,
	JobFinishedMessage,
	JobFinishedProps,
	JobId,
	JobResult,
	RespondToWebhookMessage,
	McpResponseMessage,
	McpToolResultMessage,
	RunningJob,
	SendChunkMessage,
} from './scaling.types';

/**
 * Responsible for processing jobs from the queue, i.e. running enqueued executions.
 */
@Service()
export class JobProcessor {
	private readonly runningJobs: Record<JobId, RunningJob> = {};

	constructor(
		private readonly logger: Logger,
		private readonly executionRepository: ExecutionRepository,
		private readonly workflowRepository: WorkflowRepository,
		private readonly nodeTypes: NodeTypes,
		private readonly instanceSettings: InstanceSettings,
		private readonly manualExecutionService: ManualExecutionService,
		private readonly executionsConfig: ExecutionsConfig,
		private readonly eventService: EventService,
	) {
		this.logger = this.logger.scoped('scaling');
	}

	async processJob(job: Job): Promise<JobResult> {
		// Handle MCP tool jobs (new pattern: direct tool invocation without workflow execution)
		if (job.data.jobType === 'mcp-tool' && job.data.mcpToolJobData) {
			return await this.processMcpToolJob(job);
		}

		const { executionId, loadStaticData } = job.data;

		const execution = await this.executionRepository.findSingleExecution(executionId, {
			includeData: true,
			unflattenData: true,
		});

		if (!execution) {
			throw new UnexpectedError(
				`Worker failed to find data for execution ${executionId} (job ${job.id})`,
			);
		}

		/**
		 * Bull's implicit retry mechanism and n8n's execution recovery mechanism may
		 * cause a crashed execution to be enqueued. We refrain from processing it,
		 * until we have reworked both mechanisms to prevent this scenario.
		 */
		if (execution.status === 'crashed') return { success: false };

		const workflowId = execution.workflowData.id;

		this.logger.info(`Worker started execution ${executionId} (job ${job.id})`, {
			executionId,
			workflowId,
			jobId: job.id,
		});

		const startedAt = await this.executionRepository.setRunning(executionId);

		let { staticData } = execution.workflowData;

		if (loadStaticData) {
			const workflowData = await this.workflowRepository.findOne({
				select: ['id', 'staticData'],
				where: { id: workflowId },
			});

			if (workflowData === null) {
				throw new UnexpectedError(
					`Worker failed to find workflow ${workflowId} to run execution ${executionId} (job ${job.id})`,
				);
			}

			staticData = workflowData.staticData;
		}

		const workflowSettings = execution.workflowData.settings ?? {};

		let workflowTimeout = workflowSettings.executionTimeout ?? this.executionsConfig.timeout;

		let executionTimeoutTimestamp: number | undefined;

		if (workflowTimeout > 0) {
			workflowTimeout = Math.min(workflowTimeout, this.executionsConfig.maxTimeout);
			executionTimeoutTimestamp = Date.now() + workflowTimeout * 1000;
		}

		const workflow = new Workflow({
			id: workflowId,
			name: execution.workflowData.name,
			nodes: execution.workflowData.nodes,
			connections: execution.workflowData.connections,
			active: getWorkflowActiveStatusFromWorkflowData(execution.workflowData),
			nodeTypes: this.nodeTypes,
			staticData,
			settings: execution.workflowData.settings,
		});

		const additionalData = await WorkflowExecuteAdditionalData.getBase({
			workflowId,
			executionTimeoutTimestamp,
			workflowSettings: execution.workflowData.settings,
		});
		additionalData.streamingEnabled = job.data.streamingEnabled;
		additionalData.restartExecutionId = job.data.restartExecutionId;

		const { pushRef } = job.data;

		const lifecycleHooks = getLifecycleHooksForScalingWorker(
			{
				executionMode: execution.mode,
				workflowData: execution.workflowData,
				retryOf: execution.retryOf,
				pushRef,
			},
			executionId,
		);
		additionalData.hooks = lifecycleHooks;

		if (pushRef) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			additionalData.sendDataToUI = WorkflowExecuteAdditionalData.sendDataToUI.bind({ pushRef });
		}

		lifecycleHooks.addHandler('sendResponse', async (response): Promise<void> => {
			// Check if this is an MCP execution - broadcast response to all mains
			if (job.data.isMcpExecution && job.data.mcpSessionId) {
				const msg: McpResponseMessage = {
					kind: 'mcp-response',
					executionId,
					mcpType: job.data.mcpType ?? 'service',
					sessionId: job.data.mcpSessionId,
					messageId: job.data.mcpMessageId ?? '',
					response,
					workerId: this.instanceSettings.hostId,
				};

				await job.progress(msg);
				return;
			}

			// Standard webhook response
			const msg: RespondToWebhookMessage = {
				kind: 'respond-to-webhook',
				executionId,
				response: this.encodeWebhookResponse(response),
				workerId: this.instanceSettings.hostId,
			};

			await job.progress(msg);
		});

		lifecycleHooks.addHandler('sendChunk', async (chunk: StructuredChunk): Promise<void> => {
			const msg: SendChunkMessage = {
				kind: 'send-chunk',
				executionId,
				chunkText: chunk,
				workerId: this.instanceSettings.hostId,
			};

			await job.progress(msg);
		});

		additionalData.executionId = executionId;

		additionalData.setExecutionStatus = (status: ExecutionStatus) => {
			// Can't set the status directly in the queued worker, but it will happen in InternalHook.onWorkflowPostExecute
			this.logger.debug(
				`Queued worker execution status for execution ${executionId} (job ${job.id}) is "${status}"`,
				{
					executionId,
					workflowId,
					jobId: job.id,
				},
			);
		};

		let workflowExecute: WorkflowExecute;
		let workflowRun: PCancelable<IRun>;

		const { startData, resultData, manualData } = execution.data;

		if (execution.data?.executionData) {
			workflowExecute = new WorkflowExecute(additionalData, execution.mode, execution.data);
			workflowRun = workflowExecute.processRunExecutionData(workflow);
		} else {
			const data: IWorkflowExecutionDataProcess = {
				executionMode: execution.mode,
				workflowData: execution.workflowData,
				destinationNode: startData?.destinationNode,
				startNodes: startData?.startNodes,
				runData: resultData.runData,
				pinData: resultData.pinData,
				dirtyNodeNames: manualData?.dirtyNodeNames,
				triggerToStartFrom: manualData?.triggerToStartFrom,
				userId: manualData?.userId,
			};

			try {
				workflowRun = this.manualExecutionService.runManually(
					data,
					workflow,
					additionalData,
					executionId,
					resultData.pinData,
				);
			} catch (error) {
				if (error instanceof WorkflowHasIssuesError) {
					// execution did not even start, but we call `workflowExecuteAfter` to notify main

					const now = new Date();
					const runData: IRun = {
						mode: 'manual',
						status: 'error',
						finished: false,
						startedAt: now,
						stoppedAt: now,
						data: createRunExecutionData({ resultData: { error, runData: {} } }),
						storedAt: execution.storedAt,
					};

					await lifecycleHooks.runHook('workflowExecuteAfter', [runData]);
					return { success: false };
				}
				throw error;
			}
		}

		const runningJob: RunningJob = {
			run: workflowRun,
			executionId,
			workflowId: execution.workflowId,
			workflowName: execution.workflowData.name,
			mode: execution.mode,
			startedAt,
			retryOf: execution.retryOf ?? undefined,
			status: execution.status,
		};

		this.runningJobs[job.id] = runningJob;

		const run = await workflowRun;

		delete this.runningJobs[job.id];

		const props = process.env.N8N_MINIMIZE_EXECUTION_DATA_FETCHING
			? this.deriveJobFinishedProps(run, startedAt)
			: await this.fetchJobFinishedResult(executionId);

		this.logger.info(`Worker finished execution ${executionId} (job ${job.id})`, {
			executionId,
			workflowId,
			jobId: job.id,
			success: props.success,
		});

		const msg: JobFinishedMessage = {
			kind: 'job-finished',
			version: 2,
			executionId,
			workerId: this.instanceSettings.hostId,
			...props,
		};

		await job.progress(msg);

		/**
		 * @important Do NOT call `workflowExecuteAfter` hook here.
		 * It is being called from processSuccessExecution() already.
		 */

		return { success: true };
	}

	private deriveJobFinishedProps(run: IRun, startedAt: Date): JobFinishedProps {
		return {
			success: run.status !== 'error' && run.data.resultData.error === undefined,
			status: run.status,
			error: run.data.resultData.error,
			startedAt,
			stoppedAt: run.stoppedAt!,
			lastNodeExecuted: run.data.resultData.lastNodeExecuted,
			usedDynamicCredentials: !!run.data.executionData?.runtimeData?.credentials,
			metadata: run.data.resultData.metadata,
		};
	}

	private async fetchJobFinishedResult(executionId: string): Promise<JobFinishedProps> {
		const execution = await this.executionRepository.findSingleExecution(executionId, {
			includeData: true,
			unflattenData: true,
		});

		if (!execution) {
			throw new UnexpectedError(
				`Worker failed to find execution ${executionId} immediately after workflow completed`,
			);
		}

		return {
			success: execution.status !== 'error' && execution.data?.resultData?.error === undefined,
			status: execution.status,
			error: execution.data?.resultData?.error,
			startedAt: execution.startedAt,
			stoppedAt: execution.stoppedAt!,
			lastNodeExecuted: execution.data?.resultData?.lastNodeExecuted,
			usedDynamicCredentials: !!execution.data?.executionData?.runtimeData?.credentials,
			metadata: execution.data?.resultData?.metadata,
		};
	}

	stopJob(jobId: JobId) {
		const runningJob = this.runningJobs[jobId];
		if (!runningJob) return;

		const { executionId, workflowId, workflowName } = runningJob;
		this.eventService.emit('execution-cancelled', {
			executionId,
			workflowId,
			workflowName,
			reason: 'manual', // Job stops via scaling service are always user-initiated
		});

		runningJob.run.cancel();
		delete this.runningJobs[jobId];
	}

	getRunningJobIds(): JobId[] {
		return Object.keys(this.runningJobs);
	}

	getRunningJobsSummary(): RunningJobSummary[] {
		return Object.values(this.runningJobs).map(({ run, ...summary }) => summary);
	}

	private encodeWebhookResponse(
		response: IExecuteResponsePromiseData,
	): IExecuteResponsePromiseData {
		if (typeof response === 'object' && Buffer.isBuffer(response.body)) {
			response.body = {
				'__@N8nEncodedBuffer@__': response.body.toString(BINARY_ENCODING),
			};
		}

		return response;
	}

	/**
	 * Process an MCP tool job: invoke tool directly without creating a workflow execution.
	 * This implements the sendChunk-style pattern for clean execution logs.
	 */
	private async processMcpToolJob(job: Job): Promise<JobResult> {
		const { workflowId, mcpToolJobData } = job.data;

		if (!mcpToolJobData) {
			throw new UnexpectedError('MCP tool job missing mcpToolJobData');
		}

		const { sessionId, messageId, toolName, arguments: toolArgs, sourceNodeName } = mcpToolJobData;

		this.logger.info(`Worker processing MCP tool job (job ${job.id})`, {
			workflowId,
			toolName,
			sourceNodeName,
			jobId: job.id,
		});

		// Load workflow
		const workflowData = await this.workflowRepository.findOne({
			where: { id: workflowId },
		});

		if (!workflowData) {
			throw new UnexpectedError(`Worker failed to find workflow ${workflowId} for MCP tool job`);
		}

		const workflow = new Workflow({
			id: workflowId,
			name: workflowData.name,
			nodes: workflowData.nodes,
			connections: workflowData.connections,
			active: workflowData.active,
			nodeTypes: this.nodeTypes,
			staticData: workflowData.staticData,
			settings: workflowData.settings,
		});

		// Create lifecycle hooks with sendMcpToolResult handler (sendChunk-style pattern)
		const lifecycleHooks = new ExecutionLifecycleHooks(
			'webhook', // mode
			`mcp-tool-${job.id}`, // executionId (synthetic, not stored in DB)
			workflowData,
		);

		lifecycleHooks.addHandler(
			'sendMcpToolResult',
			async (
				sid: string,
				mid: string,
				result: unknown,
				error?: { message: string; name: string },
			): Promise<void> => {
				const msg: McpToolResultMessage = {
					kind: 'mcp-tool-result',
					sessionId: sid,
					messageId: mid,
					result,
					error,
					workerId: this.instanceSettings.hostId,
				};
				await job.progress(msg);
			},
		);

		try {
			// Invoke tool directly
			const result = await this.invokeToolDirectly(workflow, sourceNodeName, toolArgs, workflowId);

			// Send result via hook (sendChunk-style pattern)
			await lifecycleHooks.runHook('sendMcpToolResult', [sessionId, messageId, result, undefined]);

			this.logger.info(`Worker finished MCP tool job (job ${job.id})`, {
				workflowId,
				toolName,
				jobId: job.id,
				success: true,
			});

			return { success: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorName = error instanceof Error ? error.name : 'Error';

			this.logger.error(`Worker MCP tool job failed (job ${job.id})`, {
				workflowId,
				toolName,
				sourceNodeName,
				jobId: job.id,
				error: errorMessage,
			});

			// Send error via hook
			await lifecycleHooks.runHook('sendMcpToolResult', [
				sessionId,
				messageId,
				null,
				{ message: errorMessage, name: errorName },
			]);

			return { success: false };
		}
	}

	/**
	 * Invoke a tool directly using the supplyData pattern.
	 * This creates a minimal context and invokes the tool without creating a full workflow execution.
	 */
	private async invokeToolDirectly(
		workflow: Workflow,
		sourceNodeName: string,
		toolArgs: Record<string, unknown>,
		workflowId: string,
	): Promise<unknown> {
		const toolNode = workflow.getNode(sourceNodeName);
		if (!toolNode) {
			throw new UnexpectedError(`Tool node "${sourceNodeName}" not found in workflow`);
		}

		// Get node type
		const nodeType = this.nodeTypes.getByNameAndVersion(toolNode.type, toolNode.typeVersion);
		if (!nodeType) {
			throw new UnexpectedError(
				`Node type "${toolNode.type}" version ${toolNode.typeVersion} not found`,
			);
		}

		// Create minimal additionalData
		const additionalData = await WorkflowExecuteAdditionalData.getBase({
			workflowId,
		});

		// Create minimal run execution data
		const runExecutionData = createRunExecutionData();

		// Cast toolArgs to IDataObject for type compatibility
		const toolArgsData = toolArgs as INodeExecutionData['json'];

		// Create input data for the context
		const connectionInputData: INodeExecutionData[] = [
			{
				json: toolArgsData,
			},
		];

		const inputData: ITaskDataConnections = {
			[NodeConnectionTypes.AiTool]: [[{ json: toolArgsData }]],
		};

		const executeData: IExecuteData = {
			node: toolNode,
			data: { main: [[{ json: toolArgsData }]] },
			source: null,
		};

		const closeFunctions: CloseFunction[] = [];

		// Create SupplyDataContext for tool invocation
		const context = new SupplyDataContext(
			workflow,
			toolNode,
			additionalData,
			'webhook',
			runExecutionData,
			0, // runIndex
			connectionInputData,
			inputData,
			NodeConnectionTypes.AiTool,
			executeData,
			closeFunctions,
			undefined, // abortSignal
			undefined, // parentNode
		);

		// Check if node has supplyData method
		if (nodeType.supplyData) {
			// Call supplyData to get the tool
			const supplyResult = await nodeType.supplyData.call(context, 0);
			const tool = supplyResult.response;

			// Validate tool and invoke
			if (
				tool &&
				typeof tool === 'object' &&
				'invoke' in tool &&
				typeof tool.invoke === 'function'
			) {
				const result = await tool.invoke(toolArgs);

				// Run close functions
				for (const closeFunction of closeFunctions) {
					await closeFunction();
				}

				return result;
			} else {
				throw new UnexpectedError(`Tool "${sourceNodeName}" does not have an invoke method`);
			}
		} else {
			// Fallback: execute the node directly if it doesn't have supplyData
			// This is similar to the existing executeToolNode but simplified
			const validatedToolArgs =
				typeof toolArgs === 'object' && toolArgs !== null && !Array.isArray(toolArgs)
					? toolArgs
					: {};

			const nodeInputData: INodeExecutionData[][] = [
				[{ json: validatedToolArgs as INodeExecutionData['json'] }],
			];

			const nodeExecutionStack: IExecuteData[] = [
				{
					node: toolNode,
					data: { main: nodeInputData },
					source: null,
				},
			];

			const toolRunData = createRunExecutionData({
				executionData: { nodeExecutionStack },
			});

			const workflowExecute = new WorkflowExecute(additionalData, 'webhook', toolRunData);
			const toolRun = await workflowExecute.processRunExecutionData(workflow);

			const nodeRunData = toolRun.data.resultData.runData[sourceNodeName];
			if (!nodeRunData || nodeRunData.length === 0) {
				return { error: 'Tool execution produced no output' };
			}

			const lastRun = nodeRunData[nodeRunData.length - 1];
			const outputData = lastRun.data?.[NodeConnectionTypes.Main]?.[0];

			if (!outputData || outputData.length === 0) {
				return { error: 'Tool execution produced empty output' };
			}

			return outputData[0]?.json;
		}
	}
}
