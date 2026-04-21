import { createClient } from "@/lib/supabase/server";
import fs from "fs/promises";
import path from "path";

const TARGET_CHUNK_SIZE = 2000; // ~2000 characters per chunk
const MIN_CHUNK_SIZE = 200; // Don't create tiny chunks

export interface TextChunk {
  text: string;
  index: number;
  totalChunks: number;
}

/**
 * Download a PDF from Supabase Storage and extract text using pdf-parse.
 * Returns the raw extracted text.
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  // Construct absolute path from the relative database path
  // `filePath` is expected to be like "resources/part/paper/module/file.pdf"
  const absolutePath = path.join(process.cwd(), "public", filePath);

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(absolutePath);
  } catch (error) {
    throw new Error(`Failed to read PDF from filesystem: ${(error as Error).message}`);
  }

  // Use pdf-parse to extract text
  // Dynamic import because pdf-parse uses require() internally
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);

  if (!result.text || result.text.trim().length === 0) {
    throw new Error("PDF contains no extractable text. It may be scanned/image-based.");
  }

  return result.text;
}

/**
 * Split extracted text into chunks of approximately TARGET_CHUNK_SIZE characters.
 * Splits on paragraph/section boundaries to avoid cutting mid-sentence.
 */
export function chunkText(text: string): TextChunk[] {
  // Normalise whitespace
  const normalised = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");

  // Split into paragraphs (double newline or section headers)
  const paragraphs = normalised.split(/\n{2,}/);

  const chunks: TextChunk[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If adding this paragraph would exceed the target, finalise current chunk
    if (
      currentChunk.length > 0 &&
      currentChunk.length + trimmed.length > TARGET_CHUNK_SIZE
    ) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunks.length,
        totalChunks: 0, // Will be set after
      });
      currentChunk = "";
    }

    // If a single paragraph is larger than target, split on sentences
    if (trimmed.length > TARGET_CHUNK_SIZE) {
      if (currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunks.length,
          totalChunks: 0,
        });
        currentChunk = "";
      }

      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (
          currentChunk.length > 0 &&
          currentChunk.length + sentence.length > TARGET_CHUNK_SIZE
        ) {
          chunks.push({
            text: currentChunk.trim(),
            index: chunks.length,
            totalChunks: 0,
          });
          currentChunk = "";
        }
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    }
  }

  // Push remaining text
  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunks.length,
      totalChunks: 0,
    });
  } else if (currentChunk.trim().length > 0 && chunks.length > 0) {
    // Append tiny remainder to last chunk
    chunks[chunks.length - 1].text += "\n\n" + currentChunk.trim();
  } else if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: 0,
      totalChunks: 0,
    });
  }

  // Set total chunks count
  const total = chunks.length;
  chunks.forEach((chunk) => {
    chunk.totalChunks = total;
  });

  return chunks;
}

/**
 * Full pipeline: download PDF → extract text → chunk.
 */
export async function processPDF(filePath: string): Promise<TextChunk[]> {
  const text = await extractTextFromPDF(filePath);
  return chunkText(text);
}
