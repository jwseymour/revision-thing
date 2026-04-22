import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    // Verify ownership of the thread
    const { data: sessionData, error: sessionError } = await supabase
      .from("supervisor_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("openai_thread_id", threadId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: "Unauthorized thread access" }, { status: 403 });
    }

    // Fetch messages from OpenAI
    const messageList = await openai.beta.threads.messages.list(threadId, {
      order: "asc", 
      limit: 100 // usually sufficient for a single session
    });

    const formattedMessages = messageList.data.map((msg) => {
      let contentString = "";
      for (const block of msg.content) {
        if (block.type === "text") {
          contentString += block.text.value;
        }
      }
      
      return {
        id: msg.id,
        role: msg.role === "assistant" ? "assistant" : "user",
        content: contentString
      };
    }).filter(msg => msg.content.trim() !== ""); // Exclude empty messages if any

    return NextResponse.json({ messages: formattedMessages });
  } catch (err: any) {
    console.error("GET Messages Error:", err);
    const errorMsg = err?.message || String(err) || "Internal error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
