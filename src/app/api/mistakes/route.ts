import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get("resolved") === "true";

    const { data: mistakes, error: fetchError } = await supabase
      .from("mistake_records")
      .select(`
        id, error_type, topic, module, description, created_at, resolved,
        attempts ( item_id, item_type )
      `)
      .eq("user_id", user.id)
      .eq("resolved", resolved)
      .order("created_at", { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ mistakes });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
