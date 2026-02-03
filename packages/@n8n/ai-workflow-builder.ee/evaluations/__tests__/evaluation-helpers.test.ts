/**
 * Tests for evaluation helper utilities.
 */

import pLimit from 'p-limit';

import { withTimeout, extractSubgraphMetrics } from '../harness/evaluation-helpers';

describe('evaluation-helpers', () => {
	describe('withTimeout()', () => {
		it('should allow p-limit slot to be released when timeout triggers (best-effort)', async () => {
			jest.useFakeTimers();
			const limit = pLimit(1);
			const started: string[] = [];

			const never = new Promise<void>(() => {
				// never resolves
			});

			const p1 = limit(async () => {
				started.push('p1');
				await withTimeout({ promise: never, timeoutMs: 10, label: 'p1' });
			}).catch(() => {
				// expected timeout
			});

			// Give p1 a chance to start.
			await Promise.resolve();

			const p2 = limit(async () => {
				started.push('p2');
			});

			jest.advanceTimersByTime(11);
			await Promise.resolve();
			await Promise.resolve();

			await expect(p2).resolves.toBeUndefined();
			expect(started).toEqual(['p1', 'p2']);

			await p1;
			jest.useRealTimers();
		});
	});

	describe('extractSubgraphMetrics()', () => {
		it('should return empty object when both inputs are undefined', () => {
			const result = extractSubgraphMetrics(undefined, undefined);
			expect(result).toEqual({});
		});

		it('should include nodeCount when provided', () => {
			const result = extractSubgraphMetrics(undefined, 5);
			expect(result).toEqual({ nodeCount: 5 });
		});

		it('should include nodeCount of 0', () => {
			const result = extractSubgraphMetrics(undefined, 0);
			expect(result).toEqual({ nodeCount: 0 });
		});

		it('should calculate discovery duration from in_progress to completed', () => {
			const coordinationLog = [
				{ phase: 'discovery' as const, status: 'in_progress' as const, timestamp: 1000 },
				{ phase: 'discovery' as const, status: 'completed' as const, timestamp: 1500 },
			];
			const result = extractSubgraphMetrics(coordinationLog, undefined);
			expect(result).toEqual({ discoveryDurationMs: 500 });
		});

		it('should calculate builder duration from in_progress to completed', () => {
			const coordinationLog = [
				{ phase: 'builder' as const, status: 'in_progress' as const, timestamp: 2000 },
				{ phase: 'builder' as const, status: 'completed' as const, timestamp: 3500 },
			];
			const result = extractSubgraphMetrics(coordinationLog, undefined);
			expect(result).toEqual({ builderDurationMs: 1500 });
		});

		it('should calculate both discovery and builder durations', () => {
			const coordinationLog = [
				{ phase: 'discovery' as const, status: 'in_progress' as const, timestamp: 1000 },
				{ phase: 'discovery' as const, status: 'completed' as const, timestamp: 1500 },
				{ phase: 'builder' as const, status: 'in_progress' as const, timestamp: 2000 },
				{ phase: 'builder' as const, status: 'completed' as const, timestamp: 3000 },
			];
			const result = extractSubgraphMetrics(coordinationLog, 10);
			expect(result).toEqual({
				nodeCount: 10,
				discoveryDurationMs: 500,
				builderDurationMs: 1000,
			});
		});

		it('should calculate duration from first to last entry when no in_progress status', () => {
			const coordinationLog = [
				{ phase: 'discovery' as const, status: 'completed' as const, timestamp: 1000 },
				{ phase: 'discovery' as const, status: 'completed' as const, timestamp: 1800 },
			];
			const result = extractSubgraphMetrics(coordinationLog, undefined);
			expect(result).toEqual({ discoveryDurationMs: 800 });
		});

		it('should ignore state_management phase', () => {
			const coordinationLog = [
				{ phase: 'state_management' as const, status: 'in_progress' as const, timestamp: 500 },
				{ phase: 'state_management' as const, status: 'completed' as const, timestamp: 600 },
			];
			const result = extractSubgraphMetrics(coordinationLog, undefined);
			expect(result).toEqual({});
		});

		it('should return undefined for phase with only one entry', () => {
			const coordinationLog = [
				{ phase: 'discovery' as const, status: 'completed' as const, timestamp: 1000 },
			];
			const result = extractSubgraphMetrics(coordinationLog, undefined);
			expect(result).toEqual({});
		});

		it('should return empty object for empty coordination log', () => {
			const result = extractSubgraphMetrics([], undefined);
			expect(result).toEqual({});
		});

		it('should calculate responder duration from in_progress to completed', () => {
			const coordinationLog = [
				{ phase: 'responder' as const, status: 'in_progress' as const, timestamp: 5000 },
				{ phase: 'responder' as const, status: 'completed' as const, timestamp: 5800 },
			];
			const result = extractSubgraphMetrics(coordinationLog, undefined);
			expect(result).toEqual({ responderDurationMs: 800 });
		});

		it('should calculate all three phase durations together', () => {
			const coordinationLog = [
				{ phase: 'discovery' as const, status: 'in_progress' as const, timestamp: 1000 },
				{ phase: 'discovery' as const, status: 'completed' as const, timestamp: 1500 },
				{ phase: 'builder' as const, status: 'in_progress' as const, timestamp: 2000 },
				{ phase: 'builder' as const, status: 'completed' as const, timestamp: 4000 },
				{ phase: 'responder' as const, status: 'in_progress' as const, timestamp: 4500 },
				{ phase: 'responder' as const, status: 'completed' as const, timestamp: 5000 },
			];
			const result = extractSubgraphMetrics(coordinationLog, 8);
			expect(result).toEqual({
				nodeCount: 8,
				discoveryDurationMs: 500,
				builderDurationMs: 2000,
				responderDurationMs: 500,
			});
		});
	});
});
