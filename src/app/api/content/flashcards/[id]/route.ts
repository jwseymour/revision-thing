import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("flashcards")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // Ensure they own it

    if (error) {
      console.error("Delete flashcard error:", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    // Also delete any existing scheduling state
    await supabase.from("item_scheduling_state").delete().eq("item_id", id);
    // Ignore error, cascade should handle it but manual deletion is safer

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
