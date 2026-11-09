import { formatHours, parseTrailingHours } from './hours';

export type DocLine =
  | { kind: 'task'; raw: string; eol: string; indent: number; done: boolean; body: string }
  | { kind: 'other'; raw: string; eol: string };

export type TaskLine = Extract<DocLine, { kind: 'task' }>;

/** `eol` : fin de ligne dominante (la premiere rencontree) pour les lignes creees. */
export interface Doc {
  lines: DocLine[];
  eol: string;
}

const TASK_LINE = /^(\s*)- \[( |x|X)\](?: (.*))?$/;

function indentWidth(whitespace: string): number {
  let width = 0;
  for (const char of whitespace) width += char === '\t' ? 4 : 1;
  return width;
}

function parseLine(raw: string, eol: string): DocLine {
  const match = TASK_LINE.exec(raw);
  if (!match) return { kind: 'other', raw, eol };
  return {
    kind: 'task',
    raw,
    eol,
    indent: indentWidth(match[1]),
    done: match[2] !== ' ',
    body: match[3] ?? '',
  };
}

/** Decoupe sans rien perdre : chaque ligne garde sa propre fin de ligne. */
export function parseDoc(text: string): Doc {
  const lines: DocLine[] = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf('\n', start);
    if (newline === -1) {
      lines.push(parseLine(text.slice(start), ''));
      break;
    }
    const crlf = newline > start && text[newline - 1] === '\r';
    const raw = text.slice(start, crlf ? newline - 1 : newline);
    lines.push(parseLine(raw, crlf ? '\r\n' : '\n'));
    start = newline + 1;
  }
  const firstEol = lines.find((line) => line.eol !== '')?.eol ?? '\n';
  return { lines, eol: firstEol };
}

export function serializeDoc(doc: Doc): string {
  return doc.lines.map((line) => line.raw + line.eol).join('');
}

export function taskParts(line: TaskLine): {
  text: string;
  minutes: number | null;
  hoursUnrecognized: boolean;
} {
  const parsed = parseTrailingHours(line.body);
  if (parsed) return { text: parsed.text, minutes: parsed.minutes, hoursUnrecognized: false };
  return {
    text: line.body,
    minutes: null,
    hoursUnrecognized: /\d\s*h|\d\s*min/i.test(line.body),
  };
}

/** Ligne de tache normalisee : `<tabs>- [x] texte 6h`. `depth` = nombre de tabulations. */
export function makeTaskLine(
  depth: number,
  done: boolean,
  text: string,
  minutes: number | null,
  eol: string,
): TaskLine {
  const content = [text, minutes ? formatHours(minutes) : ''].filter((part) => part !== '').join(' ');
  const raw = `${'\t'.repeat(depth)}- [${done ? 'x' : ' '}] ${content}`;
  return { kind: 'task', raw, eol, indent: depth * 4, done, body: content };
}
