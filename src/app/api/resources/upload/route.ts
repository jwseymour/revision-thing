import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = ["application/pdf"];

export async function POST(request: NextRequest) {
  try {
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

    const formData = await request.formData();
    const moduleName = formData.get("module") as string;
    const topic = formData.get("topic") as string;
    const files = formData.getAll("files") as File[];

    // Validate inputs
    if (!moduleName || !topic) {
      return NextResponse.json(
        { error: "Module and topic are required." },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required." },
        { status: 400 }
      );
    }

    // Sanitise module/topic for file paths (replace spaces with hyphens, lowercase)
    const sanitise = (s: string) =>
      s.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

    const sanitisedModule = sanitise(moduleName);
    const sanitisedTopic = sanitise(topic);

    const results: {
      id: string;
      file_name: string;
      status: string;
      error?: string;
    }[] = [];

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        results.push({
          id: "",
          file_name: file.name,
          status: "error",
          error: `Invalid file type: ${file.type}. Only PDFs are allowed.`,
        });
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        results.push({
          id: "",
          file_name: file.name,
          status: "error",
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 20MB.`,
        });
        continue;
      }

      // Build storage path
      const storagePath = `${user.id}/${sanitisedModule}/${sanitisedTopic}/${file.name}`;

      // Upload to Supabase Storage
      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("resources")
        .upload(storagePath, fileBuffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        results.push({
          id: "",
          file_name: file.name,
          status: "error",
          error: `Upload failed: ${uploadError.message}`,
        });
        continue;
      }

      // Insert resource record into DB
      const { data: resource, error: dbError } = await supabase
        .from("resources")
        .insert({
          user_id: user.id,
          module: moduleName.trim(),
          topic: topic.trim(),
          file_path: storagePath,
          file_name: file.name,
          file_size_bytes: file.size,
          status: "pending",
        })
        .select("id, file_name, status")
        .single();

      if (dbError) {
        // Try to clean up the uploaded file
        await supabase.storage.from("resources").remove([storagePath]);
        results.push({
          id: "",
          file_name: file.name,
          status: "error",
          error: `Database insert failed: ${dbError.message}`,
        });
        continue;
      }

      results.push({
        id: resource.id,
        file_name: resource.file_name,
        status: resource.status,
      });
    }

    const successful = results.filter((r) => r.status !== "error");
    const failed = results.filter((r) => r.status === "error");

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
