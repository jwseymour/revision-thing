import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      item_id,
      item_type,
      module: moduleName,
      topic,
      classification,
      error_type,
      notes,
    } = body;

    if (!item_id || !item_type || !moduleName || !topic || !classification) {
      return NextResponse.json(
        { error: "Missing required fields: item_id, item_type, module, topic, classification" },
        { status: 400 }
      );
    }

    // Insert attempt
    const { error: insertError } = await supabase.from("attempts").insert({
      user_id: user.id,
      item_id,
      item_type,
      module: moduleName,
      topic,
      classification,
      error_type: error_type || null,
      notes: notes || null,
    });

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to record attempt: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Recalculate mastery for this topic
    // Fetch recent attempts for this topic
    const { data: recentAttempts } = await supabase
      .from("attempts")
      .select("classification, created_at")
      .eq("user_id", user.id)
      .eq("module", moduleName)
      .eq("topic", topic)
      .order("created_at", { ascending: false })
      .limit(20);

    let mastery = 0;
    if (recentAttempts && recentAttempts.length > 0) {
      // Weighted scoring: recent attempts matter more
      const weights = recentAttempts.map((_, i) => Math.pow(0.85, i));
      const totalWeight = weights.reduce((s, w) => s + w, 0);

      const classificationScores: Record<string, number> = {
        confident: 100,
        guessed: 55,
        partial: 30,
        incorrect: 5,
      };

      const weightedSum = recentAttempts.reduce((sum, attempt, i) => {
        const score = classificationScores[attempt.classification] ?? 0;
        return sum + score * weights[i];
      }, 0);

      mastery = Math.round(weightedSum / totalWeight);
    }

    // Upsert mastery score
    const { error: masteryError } = await supabase
      .from("mastery_scores")
      .upsert(
        {
          user_id: user.id,
          module: moduleName,
          topic,
          score: mastery,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,module,topic" }
      );

    if (masteryError) {
      console.error("Mastery update failed:", masteryError);
    }

    return NextResponse.json({
      success: true,
      mastery,
    });
  } catch (error) {
    console.error("Attempt error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
