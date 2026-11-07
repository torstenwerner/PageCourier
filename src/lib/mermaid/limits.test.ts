import { describe, expect, it } from 'vitest';
import { mermaidLimits, validateMermaidDocument, validateMermaidSource } from './limits';

describe('validateMermaidSource', () => {
	it('accepts a bounded flowchart subset and its inclusive limits', () => {
		const nodes = Array.from({ length: mermaidLimits.maxNodes }, (_, index) => `N${index}`);
		const source = [
			'flowchart TD',
			...nodes.slice(0, -1).map((node, index) => `${node}[Step ${index}] --> ${nodes[index + 1]}`)
		].join('\n');

		expect(validateMermaidSource(source)).toEqual({ supported: true });

		const edgeLimitSource = [
			'flowchart TD',
			...Array.from(
				{ length: mermaidLimits.maxEdges },
				(_, index) =>
					`N${index % mermaidLimits.maxNodes} --> N${(index + 1) % mermaidLimits.maxNodes}`
			)
		].join('\n');
		expect(validateMermaidSource(edgeLimitSource)).toEqual({ supported: true });
		expect(
			validateMermaidSource(`flowchart TD\nA[${'x'.repeat(mermaidLimits.maxLabelCharacters)}]`)
		).toEqual({ supported: true });

		const sourceAtByteLimit = 'flowchart TD\nA[Ready]'.padEnd(mermaidLimits.maxSourceBytes, ' ');
		expect(validateMermaidSource(sourceAtByteLimit)).toEqual({ supported: true });

		const sourceAtLineLimit = ['flowchart TD', ...Array(mermaidLimits.maxLines - 1).fill('A')].join(
			'\n'
		);
		expect(validateMermaidSource(sourceAtLineLimit)).toEqual({ supported: true });
		expect(validateMermaidSource(`${sourceAtLineLimit}\n`)).toEqual({ supported: true });
		expect(validateMermaidSource(`flowchart TD\n${'A'.repeat(16)} --> B`)).toEqual({
			supported: true
		});
		expect(validateMermaidSource(`flowchart TD\n${'A'.repeat(17)} --> B`)).toEqual({
			supported: false,
			reason: 'unsupported-feature'
		});
	});

	it('rejects source and line counts above their documented boundaries', () => {
		expect(
			validateMermaidSource(`flowchart TD\nA[${'x'.repeat(mermaidLimits.maxSourceBytes)}]`)
		).toEqual({ supported: false, reason: 'source-size' });
		expect(
			validateMermaidSource(['flowchart TD', ...Array(mermaidLimits.maxLines).fill('A')].join('\n'))
		).toEqual({ supported: false, reason: 'line-count' });
	});

	it('rejects unsupported diagram types and interactive or HTML features', () => {
		expect(validateMermaidSource('gantt\ntitle Project')).toEqual({
			supported: false,
			reason: 'diagram-type'
		});
		expect(validateMermaidSource('flowchart TD\nA --> B\nclick A "javascript:alert(1)"')).toEqual({
			supported: false,
			reason: 'unsupported-feature'
		});
		expect(validateMermaidSource('flowchart TD\nA["<img src=x onerror=alert(1)>"]')).toEqual({
			supported: false,
			reason: 'unsupported-feature'
		});
		expect(validateMermaidSource('flowchart TD\nA@{ href: "https://example.com" }')).toEqual({
			supported: false,
			reason: 'unsupported-feature'
		});
	});

	it('accepts bounded sequence participants, actors, and basic messages', () => {
		const source = [
			'sequenceDiagram',
			'    participant Foo as Foo',
			'    participant Bar as Bar',
			'',
			'    Foo->>Bar: Hello Bar, how are you?',
			'    Bar-->>Foo: I am good thanks!'
		].join('\n');
		expect(validateMermaidSource(source)).toEqual({ supported: true });
		expect(
			validateMermaidSource(
				'sequenceDiagram\nactor Alice as Reader\nparticipant Bob\nAlice->Bob: One\nBob-->Alice: Two\nAlice->>Bob: Three\nBob-->>Alice: Four'
			)
		).toEqual({ supported: true });
		expect(validateMermaidSource('sequenceDiagram\nAlice->>Bob: implicit participants')).toEqual({
			supported: true
		});
	});

	it('rejects unsupported sequence syntax and embedded content', () => {
		for (const statement of [
			'Note over Alice: hello',
			'activate Alice',
			'loop repeat',
			'Alice-xBob: message',
			'participant Alice as <script>alert(1)</script>',
			'Alice->>Bob: <img src=x onerror=alert(1)>',
			'%%{init: {"securityLevel":"loose"}}%%',
			'link Alice: https://example.com',
			'Alice->>Bob: hello; link Alice: https://example.com',
			'participant IdentifierLongerThan16'
		]) {
			expect(validateMermaidSource(`sequenceDiagram\n${statement}`)).toEqual({
				supported: false,
				reason: 'unsupported-feature'
			});
		}
	});

	it('enforces inclusive sequence participant, message, and label limits', () => {
		const participants = Array.from(
			{ length: mermaidLimits.maxNodes },
			(_, i) => `participant P${i}`
		);
		expect(validateMermaidSource(['sequenceDiagram', ...participants].join('\n'))).toEqual({
			supported: true
		});
		expect(
			validateMermaidSource(['sequenceDiagram', ...participants, 'P0->>P40: extra'].join('\n'))
		).toEqual({
			supported: false,
			reason: 'node-count'
		});

		const messages = Array(mermaidLimits.maxEdges).fill('A->>B: hello');
		expect(validateMermaidSource(['sequenceDiagram', ...messages].join('\n'))).toEqual({
			supported: true
		});
		expect(
			validateMermaidSource(['sequenceDiagram', ...messages, 'B-->>A: extra'].join('\n'))
		).toEqual({
			supported: false,
			reason: 'edge-count'
		});

		for (const statement of ['participant A as ', 'A->>B: ']) {
			expect(
				validateMermaidSource(
					`sequenceDiagram\n${statement}${'😀'.repeat(mermaidLimits.maxLabelCharacters)}`
				)
			).toEqual({
				supported: true
			});
			expect(
				validateMermaidSource(
					`sequenceDiagram\n${statement}${'😀'.repeat(mermaidLimits.maxLabelCharacters + 1)}`
				)
			).toEqual({
				supported: false,
				reason: 'label-size'
			});
		}

		const sequenceAtByteLimit = 'sequenceDiagram\nA->>B: hello'.padEnd(
			mermaidLimits.maxSourceBytes,
			' '
		);
		expect(validateMermaidSource(sequenceAtByteLimit)).toEqual({ supported: true });
		expect(validateMermaidSource(`${sequenceAtByteLimit} `)).toEqual({
			supported: false,
			reason: 'source-size'
		});
		const sequenceAtLineLimit = [
			'sequenceDiagram',
			...Array(mermaidLimits.maxLines - 1).fill('participant A')
		];
		expect(validateMermaidSource(sequenceAtLineLimit.join('\n'))).toEqual({ supported: true });
		expect(validateMermaidSource([...sequenceAtLineLimit, 'participant A'].join('\n'))).toEqual({
			supported: false,
			reason: 'line-count'
		});
	});

	it('rejects labels, nodes, and edges above their documented limits', () => {
		expect(
			validateMermaidSource(`flowchart TD\nA[${'x'.repeat(mermaidLimits.maxLabelCharacters + 1)}]`)
		).toEqual({ supported: false, reason: 'label-size' });

		const nodes = Array.from({ length: mermaidLimits.maxNodes + 1 }, (_, index) => `N${index}`);
		expect(validateMermaidSource(['flowchart TD', ...nodes].join('\n'))).toEqual({
			supported: false,
			reason: 'node-count'
		});
		const underscoreNodes = Array.from(
			{ length: mermaidLimits.maxNodes + 1 },
			(_, index) => `_N${index}`
		);
		expect(validateMermaidSource(['flowchart TD', ...underscoreNodes].join('\n'))).toEqual({
			supported: false,
			reason: 'node-count'
		});

		const edges = Array.from(
			{ length: mermaidLimits.maxEdges + 1 },
			(_, index) => `N${index} --> N${index + 1}`
		);
		expect(validateMermaidSource(['flowchart TD', ...edges].join('\n'))).toEqual({
			supported: false,
			reason: 'edge-count'
		});
	});
});

describe('validateMermaidDocument', () => {
	it('limits the number and cumulative source size of diagrams', () => {
		expect(
			validateMermaidDocument(Array(mermaidLimits.maxDiagrams).fill('flowchart TD')).every(
				(result) => result.supported
			)
		).toBe(true);
		const tooMany = Array.from({ length: mermaidLimits.maxDiagrams + 1 }, () => 'flowchart TD');
		expect(validateMermaidDocument(tooMany).at(-1)).toEqual({
			supported: false,
			reason: 'document-diagram-count'
		});

		const sourceAtByteLimit = 'flowchart TD\nA[Ready]'.padEnd(mermaidLimits.maxSourceBytes, ' ');
		expect(
			validateMermaidDocument(
				Array(mermaidLimits.maxDocumentSourceBytes / mermaidLimits.maxSourceBytes).fill(
					sourceAtByteLimit
				)
			).every((result) => result.supported)
		).toBe(true);
		expect(
			validateMermaidDocument([
				sourceAtByteLimit,
				sourceAtByteLimit,
				sourceAtByteLimit,
				sourceAtByteLimit,
				'flowchart TD'
			]).at(-1)
		).toEqual({
			supported: false,
			reason: 'document-source-size'
		});
		const sequenceAtByteLimit = 'sequenceDiagram\nA->>B: hello'.padEnd(
			mermaidLimits.maxSourceBytes,
			' '
		);
		expect(
			validateMermaidDocument([
				sourceAtByteLimit,
				sequenceAtByteLimit,
				sourceAtByteLimit,
				sequenceAtByteLimit,
				'sequenceDiagram\nA->>B: hello'
			]).at(-1)
		).toEqual({ supported: false, reason: 'document-source-size' });
	});
});
