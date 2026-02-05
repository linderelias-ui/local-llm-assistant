"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";

type Msg = {
  role: "user" | "assistant";
  content: string;
};

const SWIFTY_SPRING = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.9,
};

const SWIFTY_SPRING_SOFT = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
  mass: 1,
};

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

const STORAGE_BASE_URL_KEY = "local_llm_base_url";
const STORAGE_MODEL_KEY = "local_llm_model";

type ModelOption = {
  id: string;
  name: string;
  blurb: string;
  free?: boolean;
};

// Local model list (your Ollama model names).
const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "glm-4.7-flash-neo",
    name: "GLM-4.7 Flash (local)",
    blurb: "Runs via your local Ollama backend. Rename this to match your Ollama model name.",
  },
];

const chipPrompts: { label: string; prompt: string }[] = [
  {
    label: "Draft strategy memo",
    prompt:
      "Draft a concise strategy memo for a manager. Ask 3 clarifying questions first.",
  },
  { label: "Create OKRs", prompt: "Help me create OKRs for this quarter." },
  {
    label: "Prep for board meeting",
    prompt:
      "Help me prepare for a board meeting: agenda, narrative, and risks. Ask what context you need.",
  },
  {
    label: "Solve churn problem",
    prompt:
      "Help me diagnose churn and propose a 2-week action plan. Ask for missing data.",
  },
  {
    label: "Pricing review",
    prompt:
      "Help me do a pricing review and propose experiments. Ask about segments and current pricing.",
  },
  {
    label: "Write customer email",
    prompt:
      "Write a customer email. Ask about audience, tone, and goal first.",
  },
];

function useStoredBaseUrl() {
  const [baseUrl, setBaseUrl] = React.useState<string>("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_BASE_URL_KEY) ?? "";
      setBaseUrl(stored);
    } finally {
      setLoaded(true);
    }
  }, []);

  const save = (next: string) => {
    const trimmed = next.trim().replace(/\/+$/, "");
    localStorage.setItem(STORAGE_BASE_URL_KEY, trimmed);
    setBaseUrl(trimmed);
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_BASE_URL_KEY);
    setBaseUrl("");
  };

  return { baseUrl, loaded, save, clear };
}

function useStoredModel() {
  const [model, setModel] = React.useState<string>(MODEL_OPTIONS[0]?.id ?? "");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_MODEL_KEY);
      if (stored) setModel(stored);
    } catch {
      // ignore
    }
  }, []);

  const save = (next: string) => {
    localStorage.setItem(STORAGE_MODEL_KEY, next);
    setModel(next);
  };

  return { model, save };
}

export default function Home() {
  const { baseUrl, loaded, save, clear } = useStoredBaseUrl();
  const { model, save: saveModel } = useStoredModel();
  const [input, setInput] = React.useState("");
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [sending, setSending] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [scrollToModelOnOpen, setScrollToModelOnOpen] = React.useState(false);
  const settingsModelRef = React.useRef<HTMLDivElement | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const { theme, setTheme } = useTheme();

  const spring = reduceMotion ? { duration: 0.01 } : SWIFTY_SPRING;
  const springSoft = reduceMotion ? { duration: 0.01 } : SWIFTY_SPRING_SOFT;

  const needsBaseUrl = loaded && !baseUrl;

  React.useEffect(() => {
    if (!settingsOpen || !scrollToModelOnOpen) return;
    // Let the Sheet finish its opening animation/layout.
    const t = window.setTimeout(() => {
      settingsModelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToModelOnOpen(false);
    }, 50);
    return () => window.clearTimeout(t);
  }, [settingsOpen, scrollToModelOnOpen]);

  React.useEffect(() => {
    // Keep latest messages visible (esp. on mobile where the keyboard + sticky composer can obscure content).
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  React.useEffect(() => {
    const el = composerRef.current;
    if (!el) return;

    // Auto-grow textarea up to a max height.
    el.style.height = "auto";
    const maxPx = 160; // ~6-7 lines on mobile
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
    el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
  }, [input]);

  async function send(userText: string) {
    const text = userText.trim();
    if (!text) return;
    if (!baseUrl) {
      toast.error("Add your local backend URL first.");
      return;
    }

    const nextMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    // Reset composer height immediately after clearing.
    if (composerRef.current) {
      composerRef.current.style.height = "auto";
      composerRef.current.style.overflowY = "hidden";
    }
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a calm, pragmatic assistant for business managers. Ask clarifying questions when needed. Prefer actionable structure.",
            },
            ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const data = await res.json();
      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.delta?.content ??
        "(No response)";

      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-6">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium tracking-tight text-foreground/90">
            Manager Assistant
          </div>

          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                ⋯
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Settings</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Appearance
                  </div>
                  <Tabs
                    value={theme ?? "dark"}
                    onValueChange={(v) => setTheme(v)}
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="system">System</TabsTrigger>
                      <TabsTrigger value="dark">Dark</TabsTrigger>
                      <TabsTrigger value="light">Light</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <Separator />

                <div className="space-y-3" ref={settingsModelRef}>
                  <div className="text-xs font-medium text-muted-foreground">
                    Local backend
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 text-sm">
                      {baseUrl ? (
                        <span className="block truncate" title={baseUrl}>
                          Connected: {baseUrl}
                        </span>
                      ) : (
                        "Not connected"
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        clear();
                        toast.message("Backend cleared");
                      }}
                      disabled={!baseUrl}
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Base URL
                    </div>
                    <Textarea
                      value={baseUrl}
                      onChange={(e) => save(e.target.value)}
                      placeholder="https://your-macmini.your-tailnet.ts.net/v1"
                      className="min-h-[64px]"
                    />
                    <div className="text-xs text-muted-foreground">
                      Must be HTTPS when used from a Vercel-hosted UI.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Model
                    </div>
                    <Textarea
                      value={model}
                      onChange={(e) => saveModel(e.target.value.trim())}
                      placeholder="glm-4.7-flash-neo"
                      className="min-h-[48px]"
                    />
                    <div className="text-xs text-muted-foreground">
                      Use your Ollama model name (from <span className="font-mono">ollama list</span>).
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Your backend URL is stored only on this device.
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Voice dictation</div>
                    <div className="text-xs text-muted-foreground">
                      MVP: UI only (wiring next).
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Backend gate */}
        <AnimatePresence>
          {needsBaseUrl ? (
            <motion.div
              key="keygate"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={springSoft}
              className="mt-8"
            >
              <Card className="p-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-base font-semibold">Connect local backend</div>
                    <div className="text-sm text-muted-foreground">
                      Paste your Ollama base URL (HTTPS). We store it only on this device.
                    </div>
                  </div>

                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="https://your-macmini.your-tailnet.ts.net/v1"
                    className="min-h-[80px]"
                  />

                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => {
                        const v = input.trim();
                        if (!v) return;
                        save(v);
                        setInput("");
                        toast.success("Backend saved");
                      }}
                    >
                      Continue
                    </Button>
                    <a
                      className="text-xs text-muted-foreground underline underline-offset-4"
                      href="https://tailscale.com/kb/1223/tailscale-serve"
                      target="_blank"
                      rel="noreferrer"
                    >
                      How do I expose Ollama over HTTPS?
                    </a>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Chat */}
        {!needsBaseUrl && (
          <div className="flex flex-1 min-h-0 flex-col">
            <div className="flex-1 space-y-2 overflow-y-auto py-4 pb-24">
              {messages.length === 0 ? (
                <div className="mt-10 space-y-3">
                  <div className="text-lg font-semibold tracking-tight">
                    What are you trying to accomplish?
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Pick a shortcut or ask in your own words.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {chipPrompts.map((c) => (
                      <Button
                        key={c.label}
                        variant="secondary"
                        size="sm"
                        asChild
                      >
                        <motion.button
                          type="button"
                          onClick={() => send(c.prompt)}
                          disabled={sending}
                          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                          whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                          transition={springSoft}
                        >
                          {c.label}
                        </motion.button>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={spring}
                      className={
                        m.role === "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <Card
                        className={
                          m.role === "user"
                            ? "max-w-[90%] bg-primary text-primary-foreground"
                            : "max-w-[90%]"
                        }
                      >
                        <div className="whitespace-pre-wrap px-3 py-2.5 text-sm leading-snug">
                          {m.content}
                        </div>
                      </Card>
                    </motion.div>
                  ))}

                  {sending ? (
                    <motion.div
                      key="typing"
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={spring}
                      className="flex justify-start"
                    >
                      <Card className="max-w-[90%]">
                        <TypingDots />
                      </Card>
                    </motion.div>
                  ) : null}

                  <div ref={endRef} />
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-background/80 pt-2 backdrop-blur pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <button
                  type="button"
                  className="underline-offset-4 hover:underline"
                  onClick={() => {
                    setScrollToModelOnOpen(true);
                    setSettingsOpen(true);
                  }}
                >
                  Model: {MODEL_OPTIONS.find((m) => m.id === model)?.name ?? model}
                </button>
                <div className="hidden sm:block">Enter to send · Shift+Enter for a new line</div>
              </div>

              <div className="flex gap-1.5">
                <Textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for a plan…"
                  rows={1}
                  className="min-h-12 resize-none leading-snug placeholder:whitespace-nowrap"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                />
                <Button disabled={sending} className="h-12" asChild>
                  <motion.button
                    type="button"
                    onClick={() => send(input)}
                    disabled={sending}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    transition={springSoft}
                  >
                    {sending ? "Sending…" : "Send"}
                  </motion.button>
                </Button>
              </div>

              <div className="mt-2 hidden text-[11px] text-muted-foreground sm:block">
                Tip: Enter to send · Shift+Enter for a new line.
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
