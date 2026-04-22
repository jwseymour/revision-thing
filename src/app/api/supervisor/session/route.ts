import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const moduleName = searchParams.get("module");

    if (!moduleName) {
      return NextResponse.json({ error: "Missing module" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("supervisor_sessions")
      .select("id, messages, created_at, module, openai_thread_id")
      .eq("user_id", user.id)
      .eq("module", moduleName)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ sessions: data || [] });
  } catch (err: any) {
    console.error("GET Session Error:", err);
    const errorMsg = err?.message || String(err) || "Internal error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { module: moduleName } = await req.json();

    if (!moduleName) {
      return NextResponse.json({ error: "Missing module" }, { status: 400 });
    }

    // Create Thread on OpenAI
    const openaiThread = await openai.beta.threads.create();

    // Create session in DB
    const { data, error } = await supabase
      .from("supervisor_sessions")
      .insert({
        user_id: user.id,
        module: moduleName,
        openai_thread_id: openaiThread.id,
        messages: [],
      })
      .select("id, messages, created_at, module, openai_thread_id")
      .single();

    if (error) throw error;

    return NextResponse.json({ session: data });
  } catch (err: any) {
    console.error("POST Session Error:", err);
    const errorMsg = err?.message || String(err) || "Internal error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
