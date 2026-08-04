import React from 'react';

/**
 * Minimal, dependency-free Markdown renderer for the Notes editor (Bloc 2).
 * Supports exactly what the "minimal rich text" brief asks for: headings
 * (# ## ###), **bold**, *italic*, `inline code`, ``` fenced code blocks ```,
 * and bullet / numbered lists. Everything is built as React nodes (no
 * dangerouslySetInnerHTML), so untrusted note content can never inject markup.
 */

/** Parses inline emphasis/code within a single line of text. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: code first (its content is literal), then bold, then italic.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-text-primary">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-text-primary">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Renders Markdown text into a styled React tree. */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push(
        <pre
          key={`b${key++}`}
          className="overflow-x-auto rounded-lg border border-border-strong bg-bg p-3 font-mono text-xs leading-relaxed text-text-primary"
        >
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      if (lang) { /* language label intentionally omitted for a calm look */ }
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const size = level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm';
      blocks.push(
        <p key={`b${key++}`} className={`${size} font-semibold text-text-primary`}>
          {renderInline(h[2], `h${key}`)}
        </p>,
      );
      i += 1;
      continue;
    }

    // Bullet or numbered list (a run of consecutive list lines)
    if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+[.)])\s+/, ''));
        i += 1;
      }
      const inner = items.map((it, idx) => (
        <li key={idx} className="text-text-secondary">
          {renderInline(it, `li${key}-${idx}`)}
        </li>
      ));
      blocks.push(
        ordered ? (
          <ol key={`b${key++}`} className="ml-5 list-decimal space-y-1 text-sm">
            {inner}
          </ol>
        ) : (
          <ul key={`b${key++}`} className="ml-5 list-disc space-y-1 text-sm">
            {inner}
          </ul>
        ),
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Paragraph (single line; consecutive non-empty lines become separate <p>)
    blocks.push(
      <p key={`b${key++}`} className="text-sm leading-relaxed text-text-secondary">
        {renderInline(line, `p${key}`)}
      </p>,
    );
    i += 1;
  }

  return <div className={`flex flex-col gap-2.5 ${className}`}>{blocks}</div>;
}
