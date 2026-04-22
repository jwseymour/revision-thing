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
        front: z.string().describe("A factual statement with a crucial concept or term replaced by '____'."),
        back: z.string().describe("The exact missing term or concept."),
      });
      promptInstruction = "Convert the provided excerpt into a fill-in-the-blank (cloze) statement. The blank must represent the most important high-yield concept in the excerpt.";
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

    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema,
      prompt: `
        You are a Cambridge Computer Science Professor creating strict, high-yield flashcards.
        Context: The material belongs to the university module ${resource.module}.
        Task: ${promptInstruction}
        User Request (Focus Area): ${focus || "None provided. Do a standard extraction."}
        Target Depth: ${depth || "standard"}

        CRITICAL RULES:
        1. ONLY use information present or strongly implied by the provided text. Do not hallucinate external syllabus knowledge.
        2. Keep outputs dense and unambiguous.
        3. Use standard markdown for any inline code (e.g. \`var x\`) or block structures if necessary.

        Source Excerpt:
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
