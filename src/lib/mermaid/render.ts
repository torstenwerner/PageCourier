import type { Action } from 'svelte/action';
import { mermaidLimits, validateMermaidDocument, type MermaidLimitFailure } from './limits';

type Mermaid = typeof import('mermaid').default;

const svgNamespace = 'http://www.w3.org/2000/svg';
const allowedElements = new Set([
	'svg',
	'g',
	'path',
	'rect',
	'circle',
	'ellipse',
	'polygon',
	'polyline',
	'line',
	'text',
	'tspan',
	'defs',
	'filter',
	'feDropShadow',
	'marker',
	'pattern',
	'linearGradient',
	'stop',
	'clipPath',
	'title',
	'desc',
	'style'
]);
const allowedAttributes = new Set([
	'aria-label',
	'aria-labelledby',
	'aria-roledescription',
	'class',
	'clip-path',
	'cx',
	'cy',
	'd',
	'data-edge',
	'data-et',
	'data-id',
	'data-points',
	'data-look',
	'dominant-baseline',
	'dx',
	'dy',
	'fill',
	'fill-opacity',
	'fill-rule',
	'flood-color',
	'flood-opacity',
	'font-family',
	'font-size',
	'font-style',
	'font-weight',
	'focusable',
	'height',
	'id',
	'marker-end',
	'marker-start',
	'markerWidth',
	'markerHeight',
	'markerUnits',
	'offset',
	'opacity',
	'orient',
	'points',
	'preserveAspectRatio',
	'r',
	'refX',
	'refY',
	'role',
	'rx',
	'ry',
	'stop-color',
	'stop-opacity',
	'stroke',
	'stroke-dasharray',
	'stroke-dashoffset',
	'stroke-linecap',
	'stroke-linejoin',
	'stroke-opacity',
	'stroke-width',
	'stdDeviation',
	'text-anchor',
	'transform',
	'version',
	'viewBox',
	'width',
	'x',
	'x1',
	'x2',
	'y',
	'y1',
	'y2',
	'xmlns'
]);
const unsafeCssPattern = /@import|expression\s*\(|javascript\s*:|data\s*:|behavior\s*:/i;
const externalCssUrlPattern = /url\s*\(\s*(?!#[\w.-]+\s*\))[^)]*\)/i;

let mermaidPromise: Promise<Mermaid> | undefined;

function getMermaid(): Promise<Mermaid> {
	mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'strict',
			htmlLabels: false,
			suppressErrorRendering: true,
			maxTextSize: mermaidLimits.maxSourceBytes,
			maxEdges: mermaidLimits.maxEdges,
			flowchart: {
				htmlLabels: false,
				curve: 'linear',
				useMaxWidth: true
			}
		});
		return mermaid;
	});
	return mermaidPromise;
}

function validateCss(value: string): void {
	if (unsafeCssPattern.test(value) || externalCssUrlPattern.test(value)) {
		throw new Error('The rendered diagram contains unsafe styling.');
	}
}

function sanitizeSvg(svg: string): SVGSVGElement {
	if (svg.length > 131_072) throw new Error('The rendered diagram is too large.');
	const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
	const root = document.documentElement;
	if (root.localName !== 'svg' || root.namespaceURI !== svgNamespace) {
		throw new Error('The rendered diagram is not SVG.');
	}

	for (const element of [root, ...root.querySelectorAll('*')]) {
		if (element.namespaceURI !== svgNamespace || !allowedElements.has(element.localName)) {
			throw new Error(`Unsupported SVG element: ${element.localName}.`);
		}
		for (const attribute of [...element.attributes]) {
			const name = attribute.name.toLowerCase();
			if (name === 'style') {
				validateCss(attribute.value);
				element.removeAttributeNode(attribute);
				continue;
			}
			if (name.startsWith('on') || !allowedAttributes.has(attribute.name)) {
				throw new Error(`Unsupported SVG attribute: ${attribute.name}.`);
			}
			if (/url\s*\(/i.test(attribute.value)) validateCss(attribute.value);
		}
		if (element.localName === 'style') validateCss(element.textContent ?? '');
	}

	const result = window.document.createElementNS(svgNamespace, 'svg');
	for (const attribute of [...root.attributes]) {
		result.setAttribute(attribute.name, attribute.value);
	}
	for (const child of [...root.childNodes]) {
		result.append(window.document.importNode(child, true));
	}
	result.setAttribute('role', 'img');
	result.setAttribute('aria-label', 'Rendered Mermaid flowchart');
	result.setAttribute('focusable', 'false');

	const nonce = window.document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
	if (nonce) {
		for (const style of result.querySelectorAll('style')) style.nonce = nonce;
	}

	return result;
}

function messageForFailure(reason: MermaidLimitFailure): string {
	switch (reason) {
		case 'source-size':
			return `Diagram source exceeds ${mermaidLimits.maxSourceBytes} UTF-8 bytes.`;
		case 'line-count':
			return `Diagram source exceeds ${mermaidLimits.maxLines} lines.`;
		case 'diagram-type':
			return 'Only Mermaid flowcharts with a supported direction are rendered.';
		case 'unsupported-feature':
			return 'This flowchart uses Mermaid syntax outside the supported subset.';
		case 'node-count':
			return `Diagram exceeds the ${mermaidLimits.maxNodes}-node limit.`;
		case 'edge-count':
			return `Diagram exceeds the ${mermaidLimits.maxEdges}-edge limit.`;
		case 'label-size':
			return `A diagram label exceeds ${mermaidLimits.maxLabelCharacters} characters.`;
		case 'document-diagram-count':
			return `Only the first ${mermaidLimits.maxDiagrams} diagrams can be rendered.`;
		case 'document-source-size':
			return `Diagram sources exceed the ${mermaidLimits.maxDocumentSourceBytes}-byte document limit.`;
	}
}

function createFigure(pre: HTMLPreElement, source: string) {
	const figure = window.document.createElement('figure');
	figure.className = 'mermaid-diagram';

	const output = window.document.createElement('div');
	output.className = 'mermaid-output';

	const status = window.document.createElement('p');
	status.className = 'mermaid-status';
	status.setAttribute('role', 'status');
	status.textContent = 'Rendering Mermaid flowchart…';

	const details = window.document.createElement('details');
	details.className = 'mermaid-source';
	const summary = window.document.createElement('summary');
	summary.textContent = 'View diagram source';
	details.append(summary);

	figure.append(output, status, details);
	pre.replaceWith(figure);
	details.append(pre);
	return { figure, output, status, details, source };
}

function showFailure(
	item: ReturnType<typeof createFigure>,
	message: string,
	openSource = true
): void {
	item.status.setAttribute('role', 'alert');
	item.status.textContent = `${message} The original source is available below.`;
	item.details.open = openSource;
}

async function yieldToBrowser(): Promise<void> {
	await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function renderDiagrams(root: HTMLElement, isDestroyed: () => boolean): Promise<void> {
	const codeBlocks = [...root.querySelectorAll('pre > code.language-mermaid')];
	const renderableBlocks = codeBlocks.slice(0, mermaidLimits.maxDiagrams);
	const items = renderableBlocks.map((code) => {
		const pre = code.parentElement;
		if (!(pre instanceof HTMLPreElement)) return undefined;
		return createFigure(pre, code.textContent ?? '');
	});
	const renderable = items.filter((item): item is NonNullable<typeof item> => item !== undefined);
	const validations = validateMermaidDocument(renderable.map((item) => item.source));

	if (codeBlocks.length > renderableBlocks.length) {
		const firstUnsupportedBlock = codeBlocks[mermaidLimits.maxDiagrams].parentElement;
		const notice = window.document.createElement('p');
		notice.className = 'mermaid-status';
		notice.setAttribute('role', 'alert');
		notice.textContent = `Only the first ${mermaidLimits.maxDiagrams} Mermaid diagrams can be rendered. Additional diagrams remain available as source.`;
		firstUnsupportedBlock?.before(notice);
	}

	for (const [index, result] of validations.entries()) {
		if (!result.supported) {
			showFailure(renderable[index], messageForFailure(result.reason));
		}
	}

	const pending = renderable.filter((_, index) => validations[index].supported);
	if (!pending.length || isDestroyed()) return;

	let mermaid: Mermaid;
	try {
		mermaid = await getMermaid();
	} catch {
		console.error(
			JSON.stringify({
				level: 'error',
				operation: 'mermaid-renderer',
				classification: 'RendererUnavailable'
			})
		);
		for (const item of pending) {
			showFailure(item, 'Mermaid could not be loaded.');
		}
		return;
	}

	for (const item of pending) {
		if (isDestroyed()) return;
		try {
			const { svg } = await mermaid.render(`pagecourier-${crypto.randomUUID()}`, item.source);
			if (isDestroyed()) return;
			item.output.replaceChildren(sanitizeSvg(svg));
			item.status.textContent = 'Diagram rendered. Source is available below.';
		} catch {
			showFailure(item, 'This Mermaid flowchart could not be rendered.');
		}
		await yieldToBrowser();
	}
}

export const renderMermaidDiagrams: Action<HTMLElement> = (root) => {
	let destroyed = false;
	void renderDiagrams(root, () => destroyed);
	return {
		destroy() {
			destroyed = true;
		}
	};
};
