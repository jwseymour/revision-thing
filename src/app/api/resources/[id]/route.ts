import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch the resource to get the file path
    const { data: resource, error: fetchError } = await supabase
      .from("resources")
      .select("id, file_path, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // Ensure the user owns this resource
    if (resource.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Delete associated flashcards and questions
    await supabase
      .from("flashcards")
      .delete()
      .eq("resource_id", id);

    await supabase
      .from("questions")
      .delete()
      .eq("resource_id", id);

    // Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("resources")
      .remove([resource.file_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue with DB delete even if storage delete fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("resources")
      .delete()
      .eq("id", id);

    if (dbError) {
      return NextResponse.json(
        { error: `Failed to delete resource: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
