import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const { module: moduleName, topic, threadId, message } = await req.json();

    if (!moduleName || !threadId || !message) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // 1. Fetch the assistant ID for the module
    const { data: assistantMap, error: assistantError } = await supabase
      .from("module_assistants")
      .select("openai_assistant_id")
      .eq("module", moduleName)
      .single();

    if (assistantError || !assistantMap?.openai_assistant_id) {
       console.error("Missing assistant for module:", assistantError);
       return new NextResponse("Assistant not initialized for this module. Please upload notes first.", { status: 400 });
    }

    const assistantId = assistantMap.openai_assistant_id;

    // 2. Add the user's message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });
    
    // We optionally pass topic in instructions if we want
    let additionalInstructions = `Focus on the topic: ${topic}. Guide the student Socratically but be highly concise and information dense. Cover all necessary content without unnecessary fluff. Use LaTeX math delimiters (e.g. $x^2$ or $$x^2$$).`;

    // 3. Start the run and stream
    const runStream = openai.beta.threads.runs.stream(threadId, {
      assistant_id: assistantId,
      additional_instructions: additionalInstructions
    });

    // 4. Create a readable stream that yields plaintext chunks
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runStream) {
            if (event.event === 'thread.message.delta') {
              const content = event.data.delta.content?.[0];
              if (content?.type === 'text' && content.text?.value) {
                // Return plain text chunks
                controller.enqueue(new TextEncoder().encode(content.text.value));
              }
            } else if (event.event === 'thread.run.failed') {
               console.error("Run failed:", event.data);
               controller.enqueue(new TextEncoder().encode("\n[Error: The supervisor encountered an issue answering.]"));
            }
          }
        } catch (e) {
          console.error("Stream reader error:", e);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    console.error("Supervisor API Error:", errorMsg);
    return new NextResponse(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
