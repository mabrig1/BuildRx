/**
 * Splits extracted document text into overlapping chunks for
 * embedding. Paragraph-aware: chunks are built by greedily packing
 * whole paragraphs up to `chunkSize`, carrying a character-level tail
 * of the previous chunk forward as overlap so semantic context isn't
 * lost at a chunk boundary. A single paragraph longer than `chunkSize`
 * is hard-sliced (rare — only very long unbroken text hits this).
 */

export interface ChunkOptions {
  /** Target max characters per chunk. */
  chunkSize?: number;
  /** Characters of trailing context carried into the next chunk. */
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 150;

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.max(0, Math.min(options.overlap ?? DEFAULT_OVERLAP, chunkSize - 1));

  const normalized = text.trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  function flush() {
    if (current.trim()) chunks.push(current.trim());
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      flush();
      current = "";
      const step = chunkSize - overlap;
      for (let i = 0; i < paragraph.length; i += step) {
        const slice = paragraph.slice(i, i + chunkSize).trim();
        if (slice) chunks.push(slice);
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      flush();
      const tail = overlap > 0 ? current.slice(-overlap) : "";
      current = tail ? `${tail}\n\n${paragraph}` : paragraph;
    }
  }
  flush();

  return chunks;
}
