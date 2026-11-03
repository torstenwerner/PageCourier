import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema, type Options } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { Root as HastRoot, Element } from 'hast';
import type { Heading, Root as MdastRoot } from 'mdast';
import type { Node } from 'unist';

const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const schema: Options = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		...Object.fromEntries(
			headingTags.map((tag) => [tag, [...(defaultSchema.attributes?.[tag] ?? []), 'id']])
		),
		code: [...(defaultSchema.attributes?.code ?? []), ['className', 'hljs']],
		span: [...(defaultSchema.attributes?.span ?? []), ['className', /^hljs-[\w-]+$/]],
		input: [...(defaultSchema.attributes?.input ?? []), ['type', 'checkbox'], 'checked', 'disabled']
	}
};

function isSafeLink(value: string): boolean {
	if (/^#[^\s]*$/.test(value)) return true;
	try {
		const url = new URL(value);
		return (
			(url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
		);
	} catch {
		return false;
	}
}

function isSafeImage(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && !url.username && !url.password;
	} catch {
		return false;
	}
}

function rehypeSafeUrls() {
	return (tree: HastRoot) => {
		const headingIds = new Set<string>();
		visit(tree, 'element', (node: Element) => {
			if (/^h[1-6]$/.test(node.tagName) && typeof node.properties.id === 'string') {
				headingIds.add(node.properties.id);
			}
		});

		visit(tree, 'element', (node: Element, index, parent) => {
			if (node.tagName === 'a') {
				const href = node.properties.href;
				if (typeof href === 'string' && href.startsWith('#')) {
					const target = href.slice(1);
					if (headingIds.has(target)) node.properties.href = `#user-content-${target}`;
					else delete node.properties.href;
				} else if (typeof href === 'string' && !isSafeLink(href)) {
					delete node.properties.href;
				}
			}

			if (node.tagName === 'img') {
				const src = node.properties.src;
				if (typeof src === 'string' && !isSafeImage(src) && parent && index !== undefined) {
					parent.children[index] = {
						type: 'text',
						value: typeof node.properties.alt === 'string' ? node.properties.alt : ''
					};
				}
			}
		});
	};
}

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype)
	.use(rehypeSlug)
	.use(rehypeHighlight, { detect: false, ignoreMissing: true })
	.use(rehypeSafeUrls)
	.use(rehypeSanitize, schema)
	.use(rehypeStringify);

function compactText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function plainText(node: Node): string {
	if (node.type === 'html') return '';
	if (node.type === 'break') return ' ';
	if (node.type === 'image' && 'alt' in node && typeof node.alt === 'string') return node.alt;
	if ('value' in node && typeof node.value === 'string') return node.value;
	if ('children' in node && Array.isArray(node.children)) {
		const blockContainers = ['list', 'listItem', 'blockquote', 'table', 'tableRow'];
		const separator = blockContainers.includes(node.type) ? ' ' : '';
		return node.children.map(plainText).join(separator);
	}
	return '';
}

function excerpt(value: string): string {
	const characters = Array.from(value);
	return characters.length > 180 ? `${characters.slice(0, 180).join('')}…` : value;
}

export interface RenderedMarkdown {
	html: string;
	title: string;
	description: string;
	hasH1: boolean;
}

export function renderMarkdown(source: string, filename: string): RenderedMarkdown {
	const tree = processor.parse(source) as MdastRoot;
	let title: string | undefined;
	let hasH1 = false;
	visit(tree, 'heading', (node: Heading) => {
		const headingTitle = compactText(plainText(node));
		if (!headingTitle) return;
		title ??= headingTitle;
		if (node.depth === 1) hasH1 = true;
	});
	title ??= filename;
	const contentText = tree.children.map(plainText).join(' ');
	const description = excerpt(compactText(contentText)) || 'A shared Markdown document.';
	const html = String(processor.stringify(processor.runSync(tree)));
	return { html, title, description, hasH1 };
}
