import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      baseUrl?: string; // e.g. https://<machine>.ts.net/v1
      model?: string;
      messages?: ChatMessage[];
      // optional: passthrough headers if needed later
    };

    const baseUrlRaw = (body.baseUrl ?? "").trim();
    const baseUrl = baseUrlRaw.replace(/\/+$/, "");
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Missing baseUrl." },
        { status: 400 },
      );
    }

    const messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages." }, { status: 400 });
    }

    const model = (body.model ?? "").trim();
    if (!model) {
      return NextResponse.json({ error: "Missing model." }, { status: 400 });
    }

    // OpenAI-compatible endpoint (Ollama supports /v1/chat/completions)
    const url = `${baseUrl}/chat/completions`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        // Keep it simple; expose more knobs later.
        temperature: 0.7,
        stream: false,
      }),
    });

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(text, { status: res.status });
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
