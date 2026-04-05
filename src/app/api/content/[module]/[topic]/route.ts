import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ module: string; topic: string }> }
) {
  try {
    const { module: moduleName, topic } = await params;
    const decodedModule = decodeURIComponent(moduleName);
    const decodedTopic = decodeURIComponent(topic);

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch flashcards
    const { data: flashcards, error: fcError } = await supabase
      .from("flashcards")
      .select("*")
      .eq("user_id", user.id)
      .eq("module", decodedModule)
      .eq("topic", decodedTopic)
      .order("created_at", { ascending: true });

    if (fcError) {
      return NextResponse.json(
        { error: `Failed to fetch flashcards: ${fcError.message}` },
        { status: 500 }
      );
    }

    // Fetch questions
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("*")
      .eq("user_id", user.id)
      .eq("module", decodedModule)
      .eq("topic", decodedTopic)
      .order("created_at", { ascending: true });

    if (qError) {
      return NextResponse.json(
        { error: `Failed to fetch questions: ${qError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      module: decodedModule,
      topic: decodedTopic,
      flashcards: flashcards || [],
      questions: questions || [],
    });
  } catch (error) {
    console.error("Content fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
