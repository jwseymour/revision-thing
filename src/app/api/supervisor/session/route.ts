import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const moduleName = searchParams.get("module");

    if (!moduleName) {
      return new NextResponse("Missing module parameter", { status: 400 });
    }

    const { data, error } = await supabase
      .from("supervisor_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("module", moduleName)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ sessions: data || [] });
  } catch (err: any) {
    const errorMsg = err?.message || String(err) || "Internal error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { module: moduleName } = await req.json();

    if (!moduleName) {
      return new NextResponse("Missing module parameter", { status: 400 });
    }

    const { data, error } = await supabase
      .from("supervisor_sessions")
      .insert({
        user_id: user.id,
        module: moduleName,
        messages: [],
      })
      .select("id, messages, created_at, module")
      .single();

    if (error) throw error;

    return NextResponse.json({ session: data });
  } catch (err: any) {
    const errorMsg = err?.message || String(err) || "Internal error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
