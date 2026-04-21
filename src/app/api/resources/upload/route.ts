import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

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
    const part = formData.get("part") as string;
    const paper = formData.get("paper") as string;
    const moduleName = formData.get("module") as string;
    const resourceType = formData.get("type") as string || "notes";
    const files = formData.getAll("files") as File[];

    // Validate inputs
    if (!part || !paper || !moduleName) {
      return NextResponse.json(
        { error: "Part, paper, and module are required." },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required." },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "File system uploads are only supported in local development." },
        { status: 403 }
      );
    }

    // Sanitise folder names for file paths (replace spaces with hyphens, lowercase)
    const sanitise = (s: string) =>
      s.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

    const sanitisedPart = sanitise(part);
    const sanitisedPaper = sanitise(paper);
    const sanitisedModule = sanitise(moduleName);

    const basePath = path.join(process.cwd(), "public", "resources", sanitisedPart, sanitisedPaper, sanitisedModule);

    // Ensure directory exists
    await fs.mkdir(basePath, { recursive: true });

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

      // Build relative storage path for DB
      const relativePath = `resources/${sanitisedPart}/${sanitisedPaper}/${sanitisedModule}/${file.name}`;
      const absolutePath = path.join(basePath, file.name);

      // Save to local File System
      try {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(absolutePath, fileBuffer);
      } catch (uploadError) {
        results.push({
          id: "",
          file_name: file.name,
          status: "error",
          error: `Upload failed: ${uploadError}`,
        });
        continue;
      }

      // Insert resource record into DB
      const { data: resource, error: dbError } = await supabase
        .from("resources")
        .insert({
          user_id: user.id, // we still capture the uploader
          part: part.trim(),
          paper: paper.trim(),
          module: moduleName.trim(),
          file_path: relativePath,
          file_name: file.name,
          file_size_bytes: file.size,
          status: "pending",
          type: resourceType,
        })
        .select("id, file_name, status")
        .single();

      if (dbError) {
        // Try to clean up local file
        await fs.unlink(absolutePath).catch(() => {});
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
