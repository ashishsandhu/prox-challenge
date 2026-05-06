"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { Camera, Send, ShieldAlert, Zap, X, Mic, Activity, Headphones, Moon, Sun } from "lucide-react";
import { GroundingNodes } from "@/components/interface/GroundingNodes";
import { SystemProse } from "@/components/interface/SystemProse";
import { DiagnosticCanvas } from "@/components/interface/DiagnosticCanvas";
import { SystemInitialization } from "@/components/interface/SystemInitialization";
import { DiagnosticProtocol } from "@/components/interface/DiagnosticProtocol";
import { OperationalChecklist } from "@/components/interface/OperationalChecklist";
import { OperationalChecklistPager, type OperationalChecklistEntry } from "@/components/interface/OperationalChecklistPager";
import { ConfigurationTable } from "@/components/interface/ConfigurationTable";
import { VoiceInterface } from "@/components/interface/VoiceInterface";
import { HardwareDiagnostics } from "@/components/interface/HardwareDiagnostics";
import { FaultProtocol } from "@/components/interface/FaultProtocol";
import { VoiceSystemStatus } from "@/components/interface/VoiceSystemStatus";
import { useHybridVoice } from "@/hooks/useHybridVoice";
import { hasWorkspaceVisuals, type VisualSpec } from "@/core/agentResponse";
import type { ConversationState } from "@/core/conversationState";
import type { CachedResponseData } from "@/core/prebuiltAnswers";
import { recommendFromAnswers, type QuickSetupAnswers } from "@/engines/quickSetup";
import type { FaultCode } from "@/data/HardwareFaultRegistry";
import type { ManualRef } from "@/data/ProductGrounding";
import { stripInlineMarkdown } from "@/core/textFormat";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  response?: CachedResponseData;
  faultCode?: FaultCode;
};

// ... helpers (same as before)
function pickDiagnosticProtocol(response: CachedResponseData | undefined, symptomFallback: string) {
  if (!response) return undefined;
  const spec = response.visuals?.find((v) => v.kind === "troubleshooting_flow");
  if (spec && spec.kind === "troubleshooting_flow") return { items: spec.items, checklist: spec.checklist, symptom: spec.symptom ?? symptomFallback };
  if (response.visualType === "troubleshooting" && (response.troubleshootingItems?.length || response.checklist?.length)) return { items: response.troubleshootingItems, checklist: response.checklist, symptom: symptomFallback };
  return undefined;
}
function pickOperationalChecklist(response: CachedResponseData | undefined) {
  const spec = response?.visuals?.find((v) => v.kind === "pre_weld_checklist");
  return spec && spec.kind === "pre_weld_checklist" ? spec : undefined;
}
function pickAllOperationalChecklists(response: CachedResponseData | undefined): OperationalChecklistEntry[] {
  if (!response?.visuals?.length) return [];
  const seen = new Set<string>();
  const out: OperationalChecklistEntry[] = [];
  for (const v of response.visuals) {
    if (v.kind === "pre_weld_checklist" && !seen.has(v.process)) {
      seen.add(v.process);
      out.push({ process: v.process, items: v.items, title: v.title });
    }
  }
  return out;
}
function pickSetupComparisonProcesses(response: CachedResponseData | undefined) {
  if (!response?.visuals?.length) return [] as Array<"mig" | "flux-core" | "tig" | "stick">;
  const seen = new Set<string>();
  const out: Array<"mig" | "flux-core" | "tig" | "stick"> = [];
  for (const v of response.visuals) {
    if (v.kind === "setup_diagram" && !seen.has(v.process)) {
      seen.add(v.process);
      out.push(v.process);
    }
  }
  return out;
}
function buildQuickSetupResponse(answers: QuickSetupAnswers): { question: string; response: CachedResponseData } {
  const rec = recommendFromAnswers(answers);
  const proc = rec.process;
  const processLabel: Record<typeof proc, string> = { mig: "MIG", "flux-core": "Flux-core", tig: "TIG", stick: "Stick" };
  const summary = [`Recommended process: **${processLabel[proc]}**.`, "", rec.why, "", `**Wiring:** ${rec.wiring}`, `**Gas:** ${rec.gas}`, "", `**Next:** ${rec.next}`, rec.dutyNote ? `\n_${rec.dutyNote}_` : "", rec.followUp ? `\n${rec.followUp}` : ""].filter(Boolean).join("\n");
  const visuals: VisualSpec[] = [{ kind: "setup_diagram", process: proc }, { kind: "pre_weld_checklist", process: proc, title: `${processLabel[proc]} pre-weld checklist` }];
  return {
    question: `Quick Setup: ${answers.location}, ${answers.hasGas === "yes" ? "with gas" : "no gas"}, ${answers.material}, ${answers.thickness}.`,
    response: { answer: summary, visualType: "polarity", process: proc, refs: [], visuals, usedModel: "quick-setup" }
  };
}
function buildFaultCodeResponse(fault: FaultCode): { question: string; response: CachedResponseData } {
  return {
    question: `What does the "${fault.label}" indicator mean?`,
    response: { 
      answer: `The **${fault.code}** indicator means the welder won't power on. I've pulled up the diagnostic steps in the workspace.`, 
      visualType: "text", 
      process: "unknown", 
      refs: [], 
      visuals: [{ kind: "fault_code", fault }],
      usedModel: "fault-code-browser" 
    }
  };
}
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
function loadingTextFor(question?: string, hasImage?: boolean) {
  if (hasImage) return "Analyzing visual data...";
  const text = question?.toLowerCase() ?? "";
  if (/duty|how long|continuous|overheat|thermal|200\s*a|240\s*v|120\s*v/.test(text)) return "Calculating thermal limits...";
  if (/polarity|setup|set ?up|cable|ground|torch|wire feed|electrode|connect|plug|hook/.test(text)) return "Routing schematics...";
  if (/porosity|spatter|pinholes?|wrong|bad weld|troubleshoot|burn|feed|bird.?nest/.test(text)) return "Running diagnostics...";
  return "Processing request...";
}
const clientCache = new Map<string, CachedResponseData>();
function generateCacheKey(query: string) { return query.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 100); }
function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function splitDataUrl(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const mediaType = header.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  return { data, mediaType: acceptedImageTypes.includes(mediaType as any) ? mediaType : "image/jpeg" };
}

const STARTER_QUESTIONS = [
  "How do I set up MIG polarity?",
  "What is the duty cycle limit at 200A?",
  "My welder stopped mid-weld — what happened?",
];

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Sync theme with DOM
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const [mounted, setMounted] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([
    { 
      id: "welcome", 
      role: "assistant", 
      content: "System initialized. Vulcan-OS Director ready for diagnostics and configuration.",
      response: { answer: "", visualType: "text", process: "unknown", refs: [], followUpPrompts: STARTER_QUESTIONS } as any
    }
  ]);
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState<{ text: string; hasImage: boolean }>();
  const [conversationState, setConversationState] = useState<ConversationState>({});
  const [streamingResponse, setStreamingResponse] = useState<CachedResponseData | undefined>(undefined);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [pinnedTurnId, setPinnedTurnId] = useState<string | null>(null);
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [faultBrowserOpen, setFaultBrowserOpen] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(560);
  
  const [voiceMode, setVoiceMode] = useState<'off' | 'immersive' | 'always-on'>('off');
  
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRequestController = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { state: handsFreeState } = useHybridVoice(voiceMode, async (question) => {
    const response = await submitPrompt(question);
    return response || "I could not process that request. Please try again.";
  });

  function handleQuickSetupSubmit(answers: QuickSetupAnswers) {
    const { question, response } = buildQuickSetupResponse(answers);
    setTurns((current) => [...current, { id: crypto.randomUUID(), role: "user", content: question }, { id: crypto.randomUUID(), role: "assistant", content: response.answer, response }]);
    setQuickSetupOpen(false);
  }

  function handleFaultSelect(fault: FaultCode) {
    const { question, response } = buildFaultCodeResponse(fault);
    setTurns((current) => [...current, { id: crypto.randomUUID(), role: "user", content: question }, { id: crypto.randomUUID(), role: "assistant", content: response.answer, response, faultCode: fault }]);
    setFaultBrowserOpen(false);
  }

  function startWorkspaceResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = workspaceWidth;
    function onPointerMove(moveEvent: PointerEvent) {
      const windowWidth = window.innerWidth;
      const nextWidth = startWidth + (startX - moveEvent.clientX);
      const minW = windowWidth * 0.25;
      const maxW = windowWidth * 0.75;
      setWorkspaceWidth(Math.min(Math.max(nextWidth, minW), maxW));
    }
    function onPointerUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  const apiMessages = useMemo(() => turns.filter((t) => t.id !== "welcome").map((t) => ({ role: t.role, content: t.content })).slice(-8), [turns]);
  const latestAssistantTurn = useMemo(() => [...turns].reverse().find((t) => t.role === "assistant" && t.response), [turns]);
  const latestResponse = latestAssistantTurn?.response;
  const latestUserQuestion = useMemo(() => [...turns].reverse().find((t) => t.role === "user")?.content, [turns]);

  const previousLatestAssistantId = useRef(latestAssistantTurn?.id);
  useEffect(() => {
    if (previousLatestAssistantId.current !== latestAssistantTurn?.id) {
      previousLatestAssistantId.current = latestAssistantTurn?.id;
      setPinnedTurnId(null);
    }
  }, [latestAssistantTurn?.id]);

  useEffect(() => {
    const handleExplainRef = (e: Event) => {
      const customEvent = e as CustomEvent<{ ref: ManualRef }>;
      const ref = customEvent.detail.ref;
      const query = `Explain ${ref.source}${ref.page ? ` page ${ref.page}` : ""}.`;
      void submitPrompt(query);
    };
    window.addEventListener("explain-manual-ref", handleExplainRef);
    return () => window.removeEventListener("explain-manual-ref", handleExplainRef);
  }, [isLoading]); // Need to rebind if isLoading changes so we don't submit while loading, or we can just rely on submitPrompt checking isLoading

  const pinnedTurn = useMemo(() => (pinnedTurnId ? turns.find((t) => t.id === pinnedTurnId) : undefined), [pinnedTurnId, turns]);
  const displayedResponse = pinnedTurn?.response ?? streamingResponse ?? latestResponse;

  const displayedUserQuestion = useMemo(() => {
    if (!pinnedTurnId) return latestUserQuestion;
    const idx = turns.findIndex((t) => t.id === pinnedTurnId);
    if (idx <= 0) return latestUserQuestion;
    for (let i = idx - 1; i >= 0; i--) if (turns[i].role === "user") return turns[i].content;
    return latestUserQuestion;
  }, [pinnedTurnId, turns, latestUserQuestion]);

  const displayedImage = useMemo(() => {
    if (pinnedTurn) return pinnedTurn.imagePreview;
    if (streamingTurnId) {
      const t = turns.find(t => t.id === streamingTurnId);
      return t?.imagePreview;
    }
    // For the latest response, find the user turn that preceded the latest assistant turn
    const latestAssistantIdx = [...turns].reverse().findIndex(t => t.role === 'assistant' && t.response);
    if (latestAssistantIdx !== -1) {
      const idx = turns.length - 1 - latestAssistantIdx;
      for (let i = idx - 1; i >= 0; i--) {
        if (turns[i].role === 'user') return turns[i].imagePreview;
      }
    }
    return undefined;
  }, [pinnedTurn, streamingTurnId, turns]);

  async function submitPrompt(prompt: string): Promise<string | undefined> {
    if (!prompt.trim() || isLoading) return;
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: "user", content: prompt.trim(), imagePreview };
    
    setTurns((current) => [...current, userTurn]);
    setLoadingPrompt({ text: prompt.trim(), hasImage: Boolean(imagePreview) });
    setInput("");
    setUploadError(undefined);
    setIsLoading(true);

    const image = imagePreview ? splitDataUrl(imagePreview) : undefined;
    const cacheKey = generateCacheKey(prompt.trim());
    let finalAnswerToReturn: string | undefined = undefined;

    if (!image) {
      const cached = clientCache.get(cacheKey);
      if (cached) {
        setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: cached.answer, response: { ...cached, cacheHit: true } }]);
        setConversationState(cached.conversationState ?? {});
        setIsLoading(false);
        return cached.answer;
      }
    }

    try {
      const controller = new AbortController();
      activeRequestController.current = controller;

      // ── Fire-and-forget fast follow-ups ──────────────────────────────────────
      const currentHistory = [...apiMessages, { role: "user", content: prompt.trim() }];
      
      let resolvedFastPrompts: string[] | null = null;
      let localAssistantTurnId: string | null = null; // Captured from inside the loop

      const fastFollowUpPromise = fetch("/api/followups", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ messages: currentHistory, currentIntent: "general" })
      })
      .then(r => r.ok ? r.json() : { prompts: [] })
      .then(data => {
        if (data.prompts && data.prompts.length > 0) {
          resolvedFastPrompts = data.prompts;
          // If the streaming turn has already started, patch it instantly
          if (localAssistantTurnId) {
            setTurns((current) => current.map((t) => {
              if (t.id === localAssistantTurnId && t.response) {
                return { ...t, response: { ...t.response, followUpPrompts: data.prompts } };
              }
              return t;
            }));
          }
        }
      })
      .catch(() => {});

      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ messages: currentHistory, conversationState, image })
      });
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantTurnId: string | null = null;
      let accumulatedText = "";
      let previewResponse: CachedResponseData | undefined;

      const scrollToBottom = () => window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let event: any;
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === "preview" && event.response) {
            previewResponse = event.response;
          } else if (event.type === "answer_delta" && typeof event.delta === "string") {
            const delta = event.delta;
            if (!assistantTurnId) {
              const id = crypto.randomUUID();
              assistantTurnId = id;
              localAssistantTurnId = id; // Give access to the fast promise
              accumulatedText = delta;
              setIsLoading(false);
              setLoadingPrompt(undefined);
              setStreamingResponse(previewResponse);
              setStreamingTurnId(id);
              
              // If fast prompts resolved before the first delta, inject them immediately
              const injectedFollowUps = resolvedFastPrompts ?? previewResponse?.followUpPrompts;
              const turnResponse = previewResponse ? { ...previewResponse, answer: delta, followUpPrompts: injectedFollowUps } : undefined;
              
              setTurns((current) => [...current, { id, role: "assistant", content: delta, response: turnResponse }]);
            } else {
              accumulatedText += delta;
              setTurns((current) => current.map((t) => (t.id === assistantTurnId ? { ...t, content: accumulatedText } : t)));
            }
            scrollToBottom();
          } else if (event.type === "complete" && event.response) {
            const data = event.response;
            
            // If the fast model finished, ensure its prompts are in the final saved response
            if (resolvedFastPrompts && (resolvedFastPrompts as string[]).length > 0) {
              data.followUpPrompts = resolvedFastPrompts as string[];
            }

            if (!image) clientCache.set(cacheKey, data);
            setConversationState(data.conversationState ?? {});
            finalAnswerToReturn = data.answer;
            if (assistantTurnId) {
              setTurns((current) => current.map((t) => (t.id === assistantTurnId ? { ...t, content: data.answer, response: data } : t)));
            } else {
              setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: data.answer, response: data }]);
            }
            setStreamingTurnId(null);
            scrollToBottom();
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "Diagnostics halted." }]);
      } else {
        setTurns((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "System connection lost. Please try again." }]);
      }
    } finally {
      activeRequestController.current = null;
      setIsLoading(false);
      setLoadingPrompt(undefined);
      setStreamingResponse(undefined);
      setStreamingTurnId(null);
    }
    return finalAnswerToReturn;
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns.length, isLoading]);

  function stopPrompt() { activeRequestController.current?.abort(); activeRequestController.current = null; }

  async function handleFile(file?: File) {
    if (!file) return;
    if (!acceptedImageTypes.includes(file.type as any)) { setUploadError("Invalid visual data format."); return; }
    setUploadError(undefined);
    setImagePreview(await readFileAsDataUrl(file));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(input);
  }

  return (
    <main className="relative flex h-screen w-full flex-col xl:flex-row bg-bg text-textPrimary transition-colors duration-300">
      
      {/* Left Pane: Chat & Controls */}
      <div className="relative flex flex-col h-1/2 xl:h-full xl:flex-1 z-10 xl:border-r xl:border-border/60 bg-surface transition-colors duration-300 shadow-panel">
        <header className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-border/50 bg-surface/50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="relative h-11 w-11 shrink-0 overflow-visible">
              <div className="h-full w-full overflow-hidden rounded-xl border border-border/60 bg-surface shadow-sm transition-transform group-hover:scale-105">
                <Image 
                  src="/images/product.webp" 
                  alt="Vulcan OmniPro 220" 
                  width={44} 
                  height={44} 
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Unified Status Badge */}
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-[#B7F54A] shadow-sm" />
            </div>
            <div>
              <h1 className="text-[13px] font-black text-textPrimary tracking-tight leading-none mb-1">VULCAN-OS DIRECTOR</h1>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-brand">System Active</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={toggleTheme}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-surface text-textSecondary hover:text-textPrimary transition-all active:scale-95"
              title={theme === 'light' ? 'Night Ops Mode' : 'Elite White Mode'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button 
              onClick={() => setQuickSetupOpen(true)} 
              className="group flex items-center gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3.5 py-2 text-[11px] font-black uppercase tracking-widest text-brand transition-all hover:bg-brand/10 hover:shadow-glow-sm active:scale-95"
            >
              <Zap size={14} className="fill-current" /> <span>Quick Setup</span>
            </button>
            <button 
              onClick={() => setFaultBrowserOpen(true)} 
              className="group flex items-center gap-2 rounded-xl border border-amber/20 bg-amber/5 px-3.5 py-2 text-[11px] font-black uppercase tracking-widest text-amber transition-all hover:bg-amber/10 active:scale-95"
            >
              <ShieldAlert size={14} className="fill-current" /> <span>Faults</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto chat-scroll px-6 py-6" ref={chatScrollRef}>
          <div className="max-w-2xl mx-auto space-y-6">
            {turns.map((turn, idx) => {
              const isAssistant = turn.role === "assistant";
              const isStreamingThisTurn = turn.id === streamingTurnId;
              const troubleFlow = isAssistant && !isStreamingThisTurn ? pickDiagnosticProtocol(turn.response, "") : undefined;
              const preWeldEntries = isAssistant && !isStreamingThisTurn ? pickAllOperationalChecklists(turn.response) : [];
              const preWeldSpec = preWeldEntries.length === 1 ? preWeldEntries[0] : (preWeldEntries.length === 0 && isAssistant && !isStreamingThisTurn ? pickOperationalChecklist(turn.response) : undefined);
              const setupComparisonProcesses = isAssistant && !isStreamingThisTurn ? pickSetupComparisonProcesses(turn.response) : [];
              return (
                <div key={turn.id} className={`flex w-full flex-col ${isAssistant ? "items-start" : "items-end"} mb-8`}>
                  <div className={`flex max-w-[90%] sm:max-w-[85%] gap-3 bubble-in`}>
                    {isAssistant && (
                      <div className="hidden sm:flex mt-1 h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand shadow-sm border border-brand/20">
                        <Activity size={16} />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <div className={`rounded-2xl px-5 py-4 text-sm module-in relative shadow-lg ${
                        isAssistant ? "bg-surface/90 backdrop-blur-md border border-white/10 text-textPrimary rounded-tl-sm" 
                                   : "bg-gradient-to-br from-brand to-brand/90 text-white rounded-tr-sm"
                      }`}>
                        {turn.role === "user" ? (
                          <p className="whitespace-pre-wrap">{turn.content}</p>
                        ) : (
                          <SystemProse content={turn.content} />
                        )}
                        
                        {setupComparisonProcesses.length >= 2 && (
                          <div className="mt-4 checklist-in"><ConfigurationTable processes={setupComparisonProcesses} /></div>
                        )}
                        {troubleFlow && (
                          <div className="mt-4 checklist-in"><DiagnosticProtocol steps={troubleFlow.checklist} items={troubleFlow.items} symptom={troubleFlow.symptom} /></div>
                        )}
                        {preWeldEntries.length >= 2 ? (
                          <div className="mt-4 checklist-in"><OperationalChecklistPager entries={preWeldEntries} /></div>
                        ) : preWeldSpec ? (
                          <div className="mt-4 checklist-in"><OperationalChecklist process={preWeldSpec.process} items={preWeldSpec.items} title={preWeldSpec.title} /></div>
                        ) : null}
                        
                        {isStreamingThisTurn && (
                          <div className="mt-3 inline-flex items-center gap-2 text-xs text-brand">
                            <span className="flex items-end gap-1" aria-hidden>
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:150ms]" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:300ms]" />
                            </span>
                          </div>
                        )}
                        {turn.response?.highlights?.warning && (
                          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber/10 border border-amber/20 px-3 py-2 text-xs font-medium text-amber">
                            <span>⚠</span> <span>{stripInlineMarkdown(turn.response.highlights.warning)}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Follow-up Prompts */}
                      {isAssistant && !isStreamingThisTurn && turn.response?.followUpPrompts && turn.response.followUpPrompts.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 ml-1 module-in">
                          {turn.response.followUpPrompts.map((prompt, i) => (
                            <button
                              key={i}
                              onClick={() => void submitPrompt(prompt)}
                              className="text-sm px-4 py-2.5 rounded-2xl border border-brand/30 bg-brand/10 text-brand hover:bg-brand hover:text-white transition-all duration-300 shadow-md whitespace-nowrap font-black uppercase tracking-tight active:scale-95"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {isLoading && !streamingTurnId && (
              <div className="flex w-full justify-start bubble-in">
                <div className="hidden sm:flex mt-1 h-6 w-6 shrink-0 items-center justify-center rounded bg-brand/10 text-brand mr-3"><Activity size={14} /></div>
                <div className="inline-flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-textSecondary shadow-sm">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:300ms]" />
                  </span>
                  <span className="font-medium tracking-wide uppercase text-xs">{loadingTextFor(loadingPrompt?.text, loadingPrompt?.hasImage)}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        </div>

        {/* Floating Command Center */}
        <div className="fixed bottom-8 left-1/2 z-50 w-full max-w-3xl -translate-x-1/2 px-4 pointer-events-none">
          <div className="pointer-events-auto relative flex flex-col gap-2 sm:gap-4 rounded-3xl border border-border/50 bg-surface/80 p-2 sm:p-3 shadow-jarvis backdrop-blur-2xl transition-all hover:bg-surface/90">
            {imagePreview && (
              <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-surface/50 p-2 pr-4 shadow-sm module-in">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Image src={imagePreview} alt="Preview" width={48} height={48} className="h-10 w-10 rounded-lg object-cover ring-1 ring-brand/30" />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-brand">Visual Ready</span>
                </div>
                <button onClick={() => setImagePreview(undefined)} className="rounded-full bg-border/50 p-1.5 text-textSecondary hover:text-textPrimary transition-colors"><X size={12}/></button>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="flex items-center gap-1 sm:gap-2">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
              
              <div className="flex items-center px-1 sm:px-2 border-r border-border/50">
                {/* Immersive / Single-Task Button */}
                <button
                  type="button"
                  onClick={() => setVoiceMode(m => m === 'immersive' ? 'off' : 'immersive')}
                  title="Talk Mode"
                  className={`group relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl transition-all active:scale-90 ${voiceMode === 'immersive' ? "bg-brand text-white shadow-glow-sm" : "text-textDim hover:text-brand hover:bg-brand/5"}`}
                >
                  <Mic size={16} className="sm:w-[18px] sm:h-[18px]" />
                  {voiceMode === 'immersive' && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand"></span>
                    </span>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-textSecondary transition-all hover:bg-surfaceUp hover:text-brand active:scale-95"
              >
                <Camera size={20} />
              </button>
              
              <div className="relative flex flex-1 items-center">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Input command query..."
                  className="h-11 w-full bg-transparent pl-2 pr-12 text-sm font-medium text-textPrimary placeholder:text-textDim focus:outline-none"
                />
                {isLoading ? (
                  <button type="button" onClick={stopPrompt} className="absolute right-1 top-1 bottom-1 flex w-9 items-center justify-center rounded-lg bg-border/50 text-textSecondary hover:text-textPrimary">
                    <X size={16} />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()} className="absolute right-1 top-1 bottom-1 flex w-9 items-center justify-center rounded-lg bg-brand text-white disabled:opacity-30 transition-all shadow-glow-sm active:scale-95">
                    <Send size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

      {/* Right Pane: Visual Workspace */}
      <div 
        className="relative flex-1 xl:flex-none h-1/2 xl:h-full z-0 overflow-hidden bg-surface shadow-2xl xl:rounded-l-[32px] border-l border-white/10"
        style={{ width: (mounted && typeof window !== 'undefined' && window.innerWidth > 1280) ? workspaceWidth : 'auto' }}
      >
        {/* Resize Handle (Desktop Only) */}
        <button
          type="button"
          onPointerDown={startWorkspaceResize}
          className="group absolute left-0 top-0 z-30 hidden h-full w-4 -translate-x-1/2 cursor-col-resize items-center justify-center xl:flex focus:outline-none"
        >
          <div className="h-20 w-1.5 rounded-full bg-border/40 transition-all group-hover:h-32 group-hover:bg-brand group-hover:w-2 group-hover:shadow-glow-sm" />
        </button>
        <DiagnosticCanvas response={displayedResponse} userQuestion={displayedUserQuestion} isLoading={isLoading && !pinnedTurnId && !streamingResponse} uploadedImage={displayedImage} />
      </div>


      <SystemInitialization open={quickSetupOpen} onClose={() => setQuickSetupOpen(false)} onSubmit={handleQuickSetupSubmit} />
      <HardwareDiagnostics open={faultBrowserOpen} onClose={() => setFaultBrowserOpen(false)} onSelect={handleFaultSelect} />
    </main>
  );
}
