import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

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
        front: z.string().describe("A factual, single-sided concise summary statement that captures the core insight."),
      });
      promptInstruction = "Distill the provided excerpt into a single, high-yield factual statement. Do not use blanks or questions; just provide the core insight.";
    } else if (type === "deep_dive") {
      schema = z.object({
        front: z.string().describe("The conceptual prompt or algorithm name (e.g., 'Describe the steps of Merge Sort')."),
        cascade_content: z.array(z.string()).describe("A sequential, logic-oriented array of steps, points, or arguments explaining the concept layer by layer. Maximum 8 items."),
      });
      promptInstruction = "Break the provided excerpt down into a clear, sequential multi-step logical sequence. This will be used in a 'cascade' flashcard where the user reveals one mechanism at a time.";
    } else { // qna
      schema = z.object({
        front: z.string().describe("A direct, unambiguous question targeting the core concept of the excerpt."),
        back: z.string().describe("A concise but comprehensive answer, using markdown for formatting where absolutely necessary."),
      });
      promptInstruction = "Create a standard Question/Answer flashcard targeting the primary knowledge/mechanism described inside the excerpt.";
    }

    let depthInstruction = "";
    if (depth === "basic") {
      depthInstruction = "Keep explanations extremely simple, high-level, and brief. Omit edge cases, granular implementation details, and pedantry.";
    } else if (depth === "advanced") {
      depthInstruction = "Include deep technical specificity, edge cases, underlying mechanics, and pedantic mathematical/logical rigor.";
    } else {
      depthInstruction = "Maintain a standard level of academic rigor—focus on core mechanisms without getting lost in minutiae.";
    }

    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema,
      prompt: `
        You are a Cambridge Computer Science Professor creating strict, high-yield flashcards.
        Context: The material belongs to the university module ${resource.module}.
        Task: ${promptInstruction}
        User Request (Focus Area): ${focus || "None provided. Do a standard extraction."}
        Target Depth: ${depthInstruction}

        CRITICAL RULES:
        1. STRICLY ENFORCE TARGET DEPTH: ${depthInstruction}
        2. USER FOCUS OVERRIDE: ${focus ? `The user provided specific instructions ("${focus}"). You MUST fulfill this request. If they ask to focus on a particular property, ignore the rest. If they give formatting instructions, follow them.` : "No specific focus provided."}
        3. EXHAUSTIVE EXTRACTION: If the source excerpt contains a list, sequence, or multiple properties, you MUST extract ALL of them across the entire text. Do not summarize or heavily truncate lists. Include properties from the beginning to the end of the text.
        4. ONLY use information present or strongly implied by the provided text. Do not hallucinate external syllabus knowledge.
        5. Keep outputs dense and unambiguous. Use standard markdown for any inline code or lists.

        Source Excerpt (Use ALL parts of this text):
        """${text}"""
      `,
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
