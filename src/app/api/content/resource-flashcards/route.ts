import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get("resourceId");

    if (!resourceId) {
      return NextResponse.json({ error: "Missing resourceId" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch flashcards for this resource
    const { data: flashcards, error } = await supabase
      .from("flashcards")
      .select("id, source_rects")
      .eq("resource_id", resourceId)
      .eq("user_id", user.id)
      .not("source_rects", "is", null);

    if (error) throw error;

    // To determine color (SM-2 mastery approx context), fetch recent attempts
    // since we don't have individual SM-2 per flashcard yet just module-level.
    // A quick proxy for Item mastery is classification of latest attempt
    const flashcardIds = flashcards.map(f => f.id);
    
    let attemptsMap: Record<string, string> = {};
    if (flashcardIds.length > 0) {
      const { data: attempts, error: attemptsError } = await supabase
        .from("attempts")
        .select("item_id, classification, created_at")
        .in("item_id", flashcardIds)
        .order("created_at", { ascending: false });
        
      if (!attemptsError && attempts) {
        // Keep only the most recent attempt per flashcard
        for (const attempt of attempts) {
          if (!attemptsMap[attempt.item_id]) {
            attemptsMap[attempt.item_id] = attempt.classification;
          }
        }
      }
    }

    // Map to normalized colour payloads
    const mappedCards = flashcards.map(f => {
      let color = "rgba(100, 150, 255, 0.3)"; // Blue/New

      const classification = attemptsMap[f.id];
      if (classification === 'incorrect') {
        color = "rgba(255, 50, 50, 0.3)"; // Red
      } else if (classification === 'correct_guessed' || classification === 'partial') {
        color = "rgba(255, 200, 50, 0.3)"; // Yellow
      } else if (classification === 'correct_confident') {
        color = "rgba(50, 200, 50, 0.3)"; // Green
      }

      return {
        id: f.id,
        source_rects: f.source_rects,
        color
      };
    });

    return NextResponse.json({ flashcards: mappedCards });

  } catch (error: any) {
    console.error("Error fetching resource flashcards:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
