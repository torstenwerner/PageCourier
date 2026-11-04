export const mermaidLimits = {
	maxSourceBytes: 4_096,
	maxLines: 64,
	maxNodes: 40,
	maxEdges: 60,
	maxLabelCharacters: 120,
	maxDiagrams: 20,
	maxDocumentSourceBytes: 16_384
} as const;

export type MermaidLimitFailure =
	| 'source-size'
	| 'line-count'
	| 'diagram-type'
	| 'unsupported-feature'
	| 'node-count'
	| 'edge-count'
	| 'label-size'
	| 'document-diagram-count'
	| 'document-source-size';

export type MermaidValidation =
	{ supported: true } | { supported: false; reason: MermaidLimitFailure };

const edgePattern = /-->|---|-\.->|==>|--o|--x|o-->|x-->|<--|<-->|<==>/g;
const labelPattern = /\[[^\]\r\n]*\]|\([^()\r\n]*\)|\{[^}\r\n]*\}|(?:\|[^|\r\n]*\|)/g;
const htmlPattern = /<\s*\/?\s*[a-z!]/i;
const forbiddenFeaturePattern =
	/(^|[^\w])(?:click|href|callback|subgraph|end|style|class|classDef|linkStyle|accTitle|accDescr|init)(?=\s|$|:|@)/i;
const supportedFirstLinePattern = /^flowchart\s+(?:TB|TD|BT|LR|RL)\s*;?$/i;

function utf8Size(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function failure(reason: MermaidLimitFailure): MermaidValidation {
	return { supported: false, reason };
}

export function validateMermaidSource(source: string): MermaidValidation {
	if (utf8Size(source) > mermaidLimits.maxSourceBytes) return failure('source-size');

	const lines = source.split(/\r\n|\r|\n/);
	if (lines.at(-1) === '') lines.pop();
	if (lines.length > mermaidLimits.maxLines) return failure('line-count');

	const firstLineIndex = lines.findIndex((line) => line.trim().length > 0);
	if (firstLineIndex < 0 || !supportedFirstLinePattern.test(lines[firstLineIndex].trim())) {
		return failure('diagram-type');
	}

	if (htmlPattern.test(source) || source.includes('%%') || source.includes('@{')) {
		return failure('unsupported-feature');
	}

	const sourceWithoutLabels = source.replace(labelPattern, ' ');
	if (forbiddenFeaturePattern.test(sourceWithoutLabels)) return failure('unsupported-feature');

	const labels = source.match(labelPattern) ?? [];
	if (
		labels.some((label) => Array.from(label.slice(1, -1)).length > mermaidLimits.maxLabelCharacters)
	) {
		return failure('label-size');
	}

	const diagramLines = lines
		.slice(firstLineIndex + 1)
		.join('\n')
		.replace(labelPattern, ' ');
	const edges = diagramLines.match(edgePattern) ?? [];
	if (edges.length > mermaidLimits.maxEdges) return failure('edge-count');

	const syntax = diagramLines.replace(edgePattern, ' ');
	if (!/^[\w\s;]*$/.test(syntax)) return failure('unsupported-feature');
	const identifiers = syntax.match(/[A-Za-z0-9_]+/g) ?? [];
	if (identifiers.some((identifier) => identifier.length > 16)) {
		return failure('unsupported-feature');
	}
	if (new Set(identifiers).size > mermaidLimits.maxNodes) return failure('node-count');

	return { supported: true };
}

export function validateMermaidDocument(sources: string[]): MermaidValidation[] {
	let totalSourceBytes = 0;
	return sources.map((source, index) => {
		if (index >= mermaidLimits.maxDiagrams) return failure('document-diagram-count');
		totalSourceBytes += utf8Size(source);
		const result = validateMermaidSource(source);
		if (!result.supported) return result;
		if (totalSourceBytes > mermaidLimits.maxDocumentSourceBytes) {
			return failure('document-source-size');
		}
		return result;
	});
}
