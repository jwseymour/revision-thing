import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get("resourceId");

    if (!resourceId) return NextResponse.json({ error: "Missing resourceId" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("past_paper_answers")
      .select("answer_text, status")
      .eq("resource_id", resourceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({ answer: data ? data.answer_text : "" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { resourceId, answerText } = body;

    if (!resourceId) return NextResponse.json({ error: "Missing resourceId" }, { status: 400 });

    const { error } = await supabase
      .from("past_paper_answers")
      .upsert({
        user_id: user.id,
        resource_id: resourceId,
        answer_text: answerText || "",
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,resource_id" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
