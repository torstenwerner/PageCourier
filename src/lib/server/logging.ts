import type { LogLevel } from './config';

type RuntimeLogLevel = Exclude<LogLevel, 'trace'>;
export type RuntimeOperation = 'request' | 'create' | 'get' | 'readiness';
export type RuntimeClassification =
	| 'OriginRejected'
	| 'Completed'
	| 'UnexpectedFailure'
	| 'AccessDenied'
	| 'NoSuchBucket'
	| 'TimeoutError'
	| 'PreconditionFailed'
	| 'ConditionalRequestConflict'
	| 'StorageFailure';
type RuntimeLogContext = {
	method?: string;
	route?: string;
	status?: number;
};

const priorities: Record<LogLevel, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60
};
const configuredPriority =
	Object.entries(priorities).find(([level]) => level === process.env.LOG_LEVEL)?.[1] ??
	priorities.info;

export function logRuntimeEvent(
	level: RuntimeLogLevel,
	operation: RuntimeOperation,
	classification: RuntimeClassification,
	context: RuntimeLogContext = {}
): void {
	if (priorities[level] < configuredPriority) return;

	const event = JSON.stringify({
		time: new Date().toISOString(),
		level,
		operation,
		classification,
		...context
	});

	if (level === 'error' || level === 'fatal') console.error(event);
	else if (level === 'warn') console.warn(event);
	else if (level === 'debug') console.debug(event);
	else console.info(event);
}
