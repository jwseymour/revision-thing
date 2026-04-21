import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data: annotations, error } = await supabase
      .from("annotations")
      .select("*")
      .eq("user_id", user.id)
      .eq("resource_id", resourceId);

    if (error) throw error;

    return NextResponse.json({ annotations });
  } catch (error: any) {
    console.error("Annotations fetch error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resource_id, content, source_rects } = await req.json();

    if (!resource_id || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("annotations")
      .insert({
        user_id: user.id,
        resource_id,
        content,
        source_rects,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ annotation: data });
  } catch (error: any) {
    console.error("Annotations save error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
