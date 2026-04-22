import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Optional: you can use Edge runtime if you prefer, but node is fine for streaming basic audio.
export const runtime = "edge";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Missing text parameter" }, { status: 400 });
    }

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    });

    // The response is a Web Response object containing a readable stream
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error: any) {
    console.error("TTS Server Error:", error);
    return NextResponse.json({ error: error.message || "TTS error" }, { status: 500 });
  }
}
