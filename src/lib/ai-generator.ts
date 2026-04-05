import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================
// Zod schemas for structured output
// ============================================================

const FlashcardSchema = z.object({
  front: z.string().describe("The question or prompt side of the flashcard"),
  back: z.string().describe("The answer or explanation side"),
  difficulty: z.number().int().min(1).max(5).describe("1=basic recall, 5=exam hard"),
  tags: z.array(z.string()).describe("Relevant topic tags for categorisation"),
});

const QuestionSchema = z.object({
  text: z.string().describe("The full question text"),
  difficulty: z.number().int().min(1).max(5).describe("1=basic, 5=exam hard"),
  tags: z.array(z.string()).describe("Relevant topic tags"),
  type: z.enum(["short_answer", "proof", "calculation", "code", "explanation"])
    .describe("The type of question"),
  solution_text: z.string().describe("The model answer/solution"),
  solution_explanation: z.string().describe("Step-by-step explanation of the solution"),
});

const GeneratedContentSchema = z.object({
  flashcards: z.array(FlashcardSchema).describe("3-6 flashcards per chunk"),
  questions: z.array(QuestionSchema).describe("2-4 exam-style questions per chunk"),
});

export type GeneratedFlashcard = z.infer<typeof FlashcardSchema>;
export type GeneratedQuestion = z.infer<typeof QuestionSchema>;
export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;

// ============================================================
// System prompt
// ============================================================

const SYSTEM_PROMPT = `You are a Cambridge Computer Science supervisor creating revision material for Tripos exams.

Your role is to generate high-quality, exam-style revision content from lecture material.

FLASHCARDS:
- Create concise flashcards that test understanding of key concepts
- Front should be a clear question or prompt
- Back should be a precise, concise answer
- Cover definitions, theorems, key properties, and important distinctions
- Vary difficulty: 1 (basic definition) to 5 (requires deep understanding)

QUESTIONS:
- Create exam-style questions that require active thinking and problem-solving
- Questions should NOT be simple recall — they should require application, analysis, or synthesis
- Types: short_answer (1-3 sentences), proof (formal argument), calculation (work through), code (write/trace code), explanation (describe/compare)
- Solutions should be detailed and show working
- Explanations should teach the reasoning, not just state the answer
- Vary difficulty from 1 (straightforward application) to 5 (Tripos exam level)

FORMATTING:
- Use LaTeX with KaTeX-compatible delimiters: $inline$ and $$display$$
- Use fenced code blocks with language identifiers for code: \`\`\`python
- Be precise with mathematical notation
- Keep flashcard answers concise but complete

Generate 3-6 flashcards and 2-4 questions per chunk of content.`;

// ============================================================
// Generation function
// ============================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate flashcards and questions from a text chunk using OpenAI.
 */
export async function generateFromChunk(
  chunkText: string,
  moduleName: string,
  topic: string,
  chunkIndex: number,
  totalChunks: number
): Promise<GeneratedContent> {
  const userPrompt = `Module: ${moduleName}
Topic: ${topic}
Chunk ${chunkIndex + 1} of ${totalChunks}

---
${chunkText}
---

Generate revision material from the above lecture content.`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const completion = await openai.beta.chat.completions.parse({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: zodResponseFormat(GeneratedContentSchema, "generated_content"),
        temperature: 0.7,
        max_tokens: 4000,
      });

      const parsed = completion.choices[0]?.message?.parsed;
      if (!parsed) {
        throw new Error("No parsed response from OpenAI");
      }

      return parsed;
    } catch (error: unknown) {
      const isRateLimit =
        error instanceof OpenAI.APIError && error.status === 429;
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (isRateLimit && !isLastAttempt) {
        console.warn(`Rate limited, retrying in ${RETRY_DELAY_MS * (attempt + 1)}ms...`);
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      if (isLastAttempt) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to generate content after ${MAX_RETRIES} attempts: ${message}`);
      }

      // Other errors: retry with backoff
      console.warn(`Generation attempt ${attempt + 1} failed, retrying...`);
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw new Error("Exhausted retries");
}
