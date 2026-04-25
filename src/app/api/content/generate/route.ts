import { createClient } from "@/lib/supabase/server";
import { processPDF } from "@/lib/pdf-processor";
import { generateFromChunk } from "@/lib/ai-generator";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300; // Allow up to 5 minutes for generation

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { resource_id } = body;

    if (!resource_id) {
      return NextResponse.json(
        { error: "resource_id is required" },
        { status: 400 }
      );
    }

    // Fetch the resource
    const { data: resource, error: fetchError } = await supabase
      .from("resources")
      .select("*")
      .eq("id", resource_id)
      .single();

    if (fetchError || !resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Update status to processing
    await supabase
      .from("resources")
      .update({ status: "processing" })
      .eq("id", resource_id);

    try {
      // Step 1: Process PDF → extract text → chunk
      const chunks = await processPDF(supabase, resource.file_path);

      if (chunks.length === 0) {
        await supabase
          .from("resources")
          .update({ status: "error", error_message: "No text could be extracted from the PDF" })
          .eq("id", resource_id);

        return NextResponse.json(
          { error: "No text could be extracted from the PDF" },
          { status: 400 }
        );
      }

      // Step 2: Generate content from each chunk
      let totalFlashcards = 0;
      let totalQuestions = 0;

      for (const chunk of chunks) {
        const generated = await generateFromChunk(
          chunk.text,
          resource.module,
          chunk.index,
          chunk.totalChunks
        );

        // Insert flashcards
        if (generated.flashcards.length > 0) {
          const flashcardRows = generated.flashcards.map((fc) => ({
            resource_id: resource_id,
            user_id: user.id,
            module: resource.module,
            front: fc.front,
            back: fc.back,
            difficulty: fc.difficulty,
            tags: fc.tags,
          }));

          const { error: fcError } = await supabase
            .from("flashcards")
            .insert(flashcardRows);

          if (fcError) {
            console.error("Failed to insert flashcards:", fcError);
          } else {
            totalFlashcards += flashcardRows.length;
          }
        }

        // Insert questions
        if (generated.questions.length > 0) {
          const questionRows = generated.questions.map((q) => ({
            resource_id: resource_id,
            user_id: user.id,
            module: resource.module,
            text: q.text,
            difficulty: q.difficulty,
            tags: q.tags,
            type: q.type,
            solution_text: q.solution_text,
            solution_explanation: q.solution_explanation,
          }));

          const { error: qError } = await supabase
            .from("questions")
            .insert(questionRows);

          if (qError) {
            console.error("Failed to insert questions:", qError);
          } else {
            totalQuestions += questionRows.length;
          }
        }
      }

      // Step 3: Update resource status to ready
      await supabase
        .from("resources")
        .update({ status: "ready", error_message: null })
        .eq("id", resource_id);

      return NextResponse.json({
        success: true,
        resource_id,
        chunks_processed: chunks.length,
        flashcards_generated: totalFlashcards,
        questions_generated: totalQuestions,
      });
    } catch (processingError) {
      // Update resource status to error
      const message =
        processingError instanceof Error
          ? processingError.message
          : "Unknown processing error";

      await supabase
        .from("resources")
        .update({ status: "error", error_message: message })
        .eq("id", resource_id);

      console.error("Content generation error:", processingError);
      return NextResponse.json(
        { error: `Generation failed: ${message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
