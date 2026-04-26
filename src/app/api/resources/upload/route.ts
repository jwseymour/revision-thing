import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = ["application/pdf"];

export const maxDuration = 60; // Max allowed for Vercel Hobby tier

export async function POST(request: NextRequest) {
  try {
    // Restrict this endpoint so it only runs locally (Admin/ingestion environment)
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "Uploads are administratively restricted to localhost environments. Resources are read-only in production." },
        { status: 403 }
      );
    }

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
    const resourceType = (formData.get("type") as string) || "notes";
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

    // Sanitise folder names for storage paths (replace spaces with hyphens, lowercase)
    const sanitise = (s: string) =>
      s.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

    const sanitisedPart = sanitise(part);
    const sanitisedPaper = sanitise(paper);
    const sanitisedModule = sanitise(moduleName);

    // Ensure OpenAI Assistant and Vector Store exist for this module
    let vectorStoreId: string | undefined;

    const { data: existingAssistant } = await supabase
      .from("module_assistants")
      .select("*")
      .eq("module", moduleName)
      .single();

    if (existingAssistant) {
      vectorStoreId = existingAssistant.openai_vector_store_id;
    } else {
      console.log(`Creating new OpenAI Vector Store and Assistant for ${moduleName}`);
      const vectorStore = await openai.vectorStores.create({ name: `tripos_${sanitisedModule}_vs` });
      vectorStoreId = vectorStore.id;

      const assistant = await openai.beta.assistants.create({
        name: `Tripos Supervisor: ${moduleName}`,
        instructions: `You are a Cambridge Computer Science supervisor. Use the provided course notes to aggressively challenge the student's understanding via Socratic questioning. Do not provide direct answers. Demand rigorous logic.`,
        model: "gpt-4o",
        tools: [{ type: "file_search" }],
        tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
      });

      const { error: assistantError } = await supabase.from("module_assistants").insert({
        module: moduleName,
        openai_assistant_id: assistant.id,
        openai_vector_store_id: vectorStore.id,
      });

      if (assistantError) {
        console.error("Failed to insert module_assistant mapping:", assistantError);
        return NextResponse.json(
          { error: `Assistant Mapping Error: ${assistantError.message}` },
          { status: 500 }
        );
      }
    }

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

      // Build storage path (used both in Supabase Storage and as the DB file_path)
      const storagePath = `resources/${sanitisedPart}/${sanitisedPaper}/${sanitisedModule}/${file.name}`;

      // Read file as buffer once — reuse for both Storage and OpenAI
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      // 1. Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("resources")
        .upload(storagePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: true, // Overwrite if same filename re-uploaded
        });

      if (storageError) {
        results.push({
          id: "",
          file_name: file.name,
          status: "error",
          error: `Storage upload failed: ${storageError.message}`,
        });
        continue;
      }

      // 2. Upload to OpenAI
      let openaiFileId = null;
      try {
        const openAiFile = await openai.files.create({
          file: await toFile(fileBuffer, file.name, { type: "application/pdf" }),
          purpose: "assistants",
        });
        openaiFileId = openAiFile.id;

        // 3. Attach file to the Module Vector Store
        if (vectorStoreId) {
          await openai.vectorStores.files.create(vectorStoreId, { file_id: openaiFileId });
        }
      } catch (oaiError) {
        console.error("OpenAI Upload Error:", oaiError);
        // Continue so at least Storage upload is recorded
      }

      // 4. Insert resource record into DB
      const { data: resource, error: dbError } = await supabase
        .from("resources")
        .insert({
          user_id: user.id,
          part: part.trim(),
          paper: paper.trim(),
          module: moduleName.trim(),
          file_path: storagePath,
          file_name: file.name,
          file_size_bytes: file.size,
          status: "ready",
          type: resourceType,
          openai_file_id: openaiFileId,
        })
        .select("id, file_name, status")
        .single();

      if (dbError) {
        // Try to clean up storage if DB insert failed
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
