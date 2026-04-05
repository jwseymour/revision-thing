import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF } from "@/lib/pdf-processor";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { messages, module: moduleName, topic, sessionId } = await req.json();

    if (!moduleName || !topic) {
      return new NextResponse("Missing module or topic", { status: 400 });
    }

    // Attempt to load PDF text for context
    let pdfContext = "";
    try {
      const { data: resource } = await supabase
        .from("resources")
        .select("file_path")
        .eq("user_id", user.id)
        .eq("module", moduleName)
        .eq("topic", topic)
        .single();

      if (resource?.file_path) {
        // Extract up to ~30000 characters to keep it well within context limits
        const fullText = await extractTextFromPDF(resource.file_path);
        pdfContext = fullText.slice(0, 30000); 
      }
    } catch (e) {
      console.error("Failed to load PDF context for supervisor:", e);
      // Proceed without pdf context if it fails
    }

    const systemPrompt = `You are a Cambridge Computer Science supervisor conducting a supervision. Your job is to test the student's understanding through Socratic questioning. 
Ask probing questions. Challenge weak or vague explanations. Force the student to articulate their reasoning precisely. 
If they are wrong, don't give the answer immediately — ask guiding questions. Be rigorous but not hostile.
Focus on the topic: ${topic} from the module: ${moduleName}.
If relevant context from their notes is provided below, base your questions on it.
Use LaTeX for math notation (e.g. $x^2$ or $$x^2$$). 

Keep your responses relatively concise (1-2 paragraphs max) to simulate a real conversation.

COURSE NOTES CONTEXT:
${pdfContext || "No course notes available."}`;

    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages,
      async onFinish({ text }) {
        if (sessionId) {
          const updatedMessages = [...messages, { role: "assistant", content: text }];
          await supabase
            .from("supervisor_sessions")
            .update({ messages: updatedMessages })
            .eq("id", sessionId)
            .eq("user_id", user.id);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    console.error("Supervisor API Error:", errorMsg);
    return new NextResponse(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
