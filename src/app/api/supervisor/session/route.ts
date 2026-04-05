import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { module: moduleName, topic } = await req.json();

    const { data, error } = await supabase
      .from("supervisor_sessions")
      .insert({
        user_id: user.id,
        module: moduleName,
        topic,
        messages: [],
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ sessionId: data.id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { sessionId, messages } = await req.json();

    const { error } = await supabase
      .from("supervisor_sessions")
      .update({ messages })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
