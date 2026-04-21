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

    const { messages, module: moduleName, sessionId, context } = await req.json();

    if (!moduleName) {
      return new NextResponse("Missing module", { status: 400 });
    }

    // Attempt to load PDF text for context
    let pdfContext = "";
    try {
      let resourceQuery = supabase.from("resources").select("file_path");
      
      if (context?.resourceId) {
        resourceQuery = resourceQuery.eq("id", context.resourceId);
      } else {
        resourceQuery = resourceQuery.eq("module", moduleName).limit(1);
      }
      
      const { data: resource } = await resourceQuery.single();

      if (resource?.file_path) {
        // Extract up to ~30000 characters to keep it well within context limits
        const fullText = await extractTextFromPDF(resource.file_path);
        pdfContext = fullText.slice(0, 30000); 
      }
    } catch (e) {
      console.error("Failed to load PDF context for supervisor:", e);
      // Proceed without pdf context if it fails
    }

    // Attempt to load supplemental pedagogical context (flashcards & comments)
    let pedagogicalContext = "";
    try {
      if (context?.resourceId) {
        const [{ data: userCards }, { data: userAnns }] = await Promise.all([
          supabase.from("flashcards").select("front, back, card_type").eq("resource_id", context.resourceId),
          supabase.from("annotations").select("content").eq("resource_id", context.resourceId)
        ]);

        if (userAnns && userAnns.length > 0) {
          pedagogicalContext += `<student_comments>\n`;
          pedagogicalContext += userAnns.map(a => `- ${a.content}`).join("\n");
          pedagogicalContext += `\n</student_comments>\n\n`;
        }

        if (userCards && userCards.length > 0) {
          pedagogicalContext += `<student_flashcards>\n`;
          pedagogicalContext += userCards.map(c => `Q: ${c.front}\nA: ${c.back}`).join("\n---\n");
          pedagogicalContext += `\n</student_flashcards>\n\n`;
        }
      }
    } catch (e) {
      console.error("Failed to load pedagogical context:", e);
    }

    let systemPrompt = `You are a Cambridge Computer Science supervisor conducting a rigorous academic supervision. Your primary job is to profoundly test the student's understanding through Socratic questioning. 

CRITICAL SUPERVISION RULES:
1. STRICT SOCRATIC METHOD: If a student asks a direct question or is struggling, DO NOT give them the direct answer. Ask a specific, granular, and guiding question that forces them to spot their own contradiction or logic gap. Offer a scaffolded hint ONLY if they are fundamentally stuck.
2. RIGOROUS CHALLENGE: Challenge weak, vague, or purely memorized explanations. Force the student to articulate the underlying mechanics, derivations, or deeper reasoning precisely. Treat them as a high-achieving undergraduate who needs to be pushed.
3. CONTEXT BOUND: Base your technical grounding heavily on the provided COURSE NOTES and their specific student context (past mistakes/flashcards). Limit broad external tangents.
4. FORMATTING AND VERBOSITY: Keep your responses concise (1-2 paragraphs max) to simulate a real-time supervision dialogue. Avoid massive info-dumps. Always use LaTeX for math notation (e.g., $O(n^2)$ or $$\\int x^2 dx$$). Use markdown for inline code (\`void main()\`).

MODULE TOPIC: ${moduleName}

COURSE NOTES / SYLLABUS CONTEXT:
${pdfContext || "No highly specific notes supplied. Rely strictly on general Cambridge CS tripos syllabus knowledge."}

STUDENT PEDAGOGICAL CONTEXT (Use this to target weaknesses):
${pedagogicalContext || "The student doesn't have recorded annotations/flashcards for this module yet."}`;

    if (context?.type === 'past_paper') {
      systemPrompt += `\n\nTHE STUDENT IS CURRENTLY ANSWERING THIS EXAM PAPER. 
Here is their current draft of their answer:
"""
${context.answerText || "[No answer written yet]"}
"""
As their supervisor, review their attempt so far. DO NOT just give them the correct answer. Tell them what they are missing, what logic they got wrong, or ask a pointing question that forces them to figure out the next step.`;
    }

    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages,
      async onFinish({ text }) {
        if (sessionId) {
          const generatedId = crypto.randomUUID(); // Safely guarantee an ID
          const updatedMessages = [...messages, { id: generatedId, role: "assistant", content: text }];
          await supabase
            .from("supervisor_sessions")
            .update({ messages: updatedMessages })
            .eq("id", sessionId)
            .eq("user_id", user.id);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    console.error("Supervisor API Error:", errorMsg);
    return new NextResponse(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
