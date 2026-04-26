import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60; // Configures Vercel to use max duration for hobby tier (or standard timeout for pro tier), preventing 504 timeouts.

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { text, type, resource_id, source_rects, focus, depth } = body;

    if (!text || !type || !resource_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch the resource to verify ownership and get module info
    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("module")
      .eq("id", resource_id)
      .single();

    if (resourceError || !resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Define the schema based on the requested type
    let schema: z.ZodType<any>;
    let promptInstruction = "";

    if (type === "statement") {
      schema = z.object({
        front: z.string().describe("A factual, single-sided summary statement that captures the core insight from the FULL excerpt."),
      });
      promptInstruction = "Distill the provided excerpt into a single, high-yield factual statement. Do not use blanks or questions; just provide the core insight.";
    } else if (type === "deep_dive") {
      schema = z.object({
        front: z.string().describe("The conceptual prompt or topic name (e.g., 'Describe the steps of Merge Sort' or 'List the properties of X')."),
        cascade_content: z.array(z.string()).describe("A sequential array of steps, points, or properties drawn exhaustively from the ENTIRE source excerpt. Include every distinct item — do not truncate or cap the list."),
      });
      promptInstruction = "Break the provided excerpt down into a clear, sequential logical sequence covering every item. This will be used in a 'cascade' flashcard where the user reveals one mechanism at a time. If the source is a list of properties, every property must appear as its own entry.";
    } else { // qna
      schema = z.object({
        front: z.string().describe("A direct, unambiguous question targeting the core concept of the FULL excerpt."),
        back: z.string().describe("A comprehensive answer that covers ALL items, properties, or steps present in the full excerpt. Use a markdown list if the answer contains multiple items. Do not omit any items."),
      });
      promptInstruction = "Create a Question/Answer flashcard that comprehensively covers the primary knowledge described in the FULL excerpt. If the excerpt contains a list, the answer must enumerate every item.";
    }

    let depthInstruction = "";
    if (depth === "basic") {
      depthInstruction = "Keep explanations simple and high-level. Omit edge cases and granular implementation details. Still include ALL items in any lists.";
    } else if (depth === "advanced") {
      depthInstruction = "Include deep technical specificity, edge cases, underlying mechanics, and pedantic mathematical/logical rigor for every item.";
    } else {
      depthInstruction = "Maintain a standard level of academic rigor — focus on core mechanisms. Still include ALL items in any lists without truncation.";
    }

    // Build the system message: role + all rules
    const systemPrompt = `You are a strict, uncompromising Cambridge Computer Science Professor creating high-yield revision flashcards for module: ${resource.module}.

ABSOLUTE RULES — you MUST obey ALL of these without exception:

RULE 1 — EXHAUSTIVE EXTRACTION (most important): The source excerpt may be long or span multiple pages. You MUST process the ENTIRE excerpt from the first word to the last word. If the excerpt contains a list of N properties, steps, or items, your output MUST include all N of them. Never truncate, stop early, or summarise away list items. Treat the source text as a contract — every distinct piece of information must appear in your output.

RULE 2 — DEPTH: ${depthInstruction} Strictly enforce this for every item in your output.

RULE 3 — USER FOCUS OVERRIDE: ${focus
      ? `The user has given the following specific instruction: "${focus}". You MUST honour this exactly. It overrides your default extraction strategy — reinterpret the task through this lens while still covering all relevant items.`
      : "No specific focus provided. Perform a comprehensive, balanced extraction."
    }

RULE 4 — SOURCE FIDELITY: Only use information present or strongly implied by the provided excerpt. Do not hallucinate external knowledge.

RULE 5 — DENSITY: Outputs must be dense and technically precise. Use markdown lists or code blocks where appropriate.`;

    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema,
      system: systemPrompt,
      prompt: `Task: ${promptInstruction}

Source Excerpt — process this in FULL, from beginning to end:
"""
${text}
"""`,
    });

    // Save to database
    let insertData: any = {
      resource_id,
      user_id: user.id,
      module: resource.module,
      card_type: type,
      source_rects,
    };

    if (type === "deep_dive") {
      insertData.front = object.front;
      insertData.back = "Cascade card - see content"; // Unused mechanically but NOT NULL constraint
      insertData.cascade_content = object.cascade_content;
    } else if (type === "statement") {
      insertData.front = object.front;
      insertData.back = "N/A";
    } else {
      insertData.front = object.front;
      insertData.back = object.back;
    }

    const { error: insertError } = await supabase
      .from("flashcards")
      .insert(insertData);

    if (insertError) {
      console.error(insertError);
      return NextResponse.json(
        { error: "Failed to save flashcard to database" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Content generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate content", details: error.message },
      { status: 500 }
    );
  }
}
