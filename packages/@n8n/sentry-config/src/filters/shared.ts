import { AxiosError } from 'axios';

export function isAxiosError(originalException: unknown): boolean {
	return originalException instanceof AxiosError;
}
