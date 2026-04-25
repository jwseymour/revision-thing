import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const dueOnly = searchParams.get("dueOnly") === "true";
    const { module: moduleName } = await params;
    const decodedModule = decodeURIComponent(moduleName);

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch flashcards
    let fcQuery = supabase.from("flashcards").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    if (decodedModule !== "all") {
      fcQuery = fcQuery.eq("module", decodedModule);
    }
    const { data: flashcards, error: fcError } = await fcQuery;

    if (fcError) {
      return NextResponse.json(
        { error: `Failed to fetch flashcards: ${fcError.message}` },
        { status: 500 }
      );
    }

    // Fetch questions
    let qQuery = supabase.from("questions").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    if (decodedModule !== "all") {
      qQuery = qQuery.eq("module", decodedModule);
    }
    const { data: questions, error: qError } = await qQuery;

    if (qError) {
      return NextResponse.json(
        { error: `Failed to fetch questions: ${qError.message}` },
        { status: 500 }
      );
    }

    let finalFlashcards = flashcards || [];
    let finalQuestions = questions || [];

    if (dueOnly) {
      const now = new Date().toISOString();
      const { data: dueItems } = await supabase
        .from("item_scheduling_state")
        .select("item_id")
        .eq("user_id", user.id)
        .lte("next_review_at", now);

      const dueItemIds = new Set((dueItems || []).map(i => i.item_id));

      // Also include items that have NO scheduling state yet (meaning they are UNSEEN)
      const { data: allStates } = await supabase
        .from("item_scheduling_state")
        .select("item_id")
        .eq("user_id", user.id);
      
      const allStateIds = new Set((allStates || []).map(i => i.item_id));

      finalFlashcards = finalFlashcards.filter(f => dueItemIds.has(f.id) || !allStateIds.has(f.id));
      finalQuestions = finalQuestions.filter(q => dueItemIds.has(q.id) || !allStateIds.has(q.id));
    }

    return NextResponse.json({
      module: decodedModule,
      flashcards: finalFlashcards,
      questions: finalQuestions,
    });
  } catch (error) {
    console.error("Content fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
