import { useState, useEffect, type ReactNode } from "react";
import { Activity, ShieldAlert, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { WiringDiagram } from "@/components/interface/WiringDiagram";
import { LoadFactorModule } from "@/components/interface/LoadFactorModule";
import { RegistryCard } from "@/components/interface/RegistryCard";
import { VisualTelemetry } from "@/components/interface/VisualTelemetry";
import { ProtocolMatrix } from "@/components/interface/ProtocolMatrix";
import { SettingsRecommendationCard } from "@/components/interface/SettingsRecommendationCard";
import { RiskMitigation } from "@/components/interface/RiskMitigation";
import { FaultProtocol } from "@/components/interface/FaultProtocol";
import { GroundingNodes } from "@/components/interface/GroundingNodes";
import { hasWorkspaceVisuals, type AgentResponse, type VisualSpec } from "@/core/agentResponse";
import { dedupeRefs, dutyCycleRows, manualImages, type ManualRef } from "@/data/ProductGrounding";

type WorkspaceResponse = AgentResponse & { warning?: string; usedModel?: string };

  export function DiagnosticCanvas({ response, userQuestion, isLoading, uploadedImage }: { response?: WorkspaceResponse; userQuestion?: string; isLoading?: boolean; uploadedImage?: string }) {
  const [activeTab, setActiveTab] = useState<"canvas" | "calculator" | "matrix" | "manual">("matrix");
  const hasVisuals = hasWorkspaceVisuals(response);

  // Automatically switch to Canvas when a new response with visuals arrives
  useEffect(() => {
    if (hasVisuals && !isLoading) {
      setActiveTab("canvas");
    }
  }, [response?.answer, hasVisuals, isLoading]);

  const tabs = [
    { id: "canvas", label: "Canvas", icon: Cpu, count: hasVisuals ? 1 : 0 },
    { id: "calculator", label: "Calculator", icon: Activity },
    { id: "matrix", label: "Process Map", icon: ShieldAlert },
    { id: "manual", label: "Reference", icon: Activity },
  ] as const;

  return (
    <aside className="relative flex h-full w-full flex-col bg-transparent p-4 xl:p-8">
      
      {/* Dynamic Canvas Container */}
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.5rem] bg-surface border border-border shadow-panel transition-colors duration-300">
        
        {/* Scanline Effect Overlay */}
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] opacity-[0.15]" />

        {/* HUD Header with Tabs */}
        <div className="absolute top-0 left-0 right-0 z-10 flex h-16 items-center px-8 border-b border-border bg-surface/50 backdrop-blur-xl transition-colors duration-300">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${active ? "bg-brand/10 text-brand shadow-[0_0_15px_rgba(245,158,11,0.1)]" : "text-textSecondary hover:bg-surfaceUp hover:text-textPrimary"}`}
                  >
                    <Icon size={14} className={active ? "text-brand" : "text-textDim"} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                    {tab.id === "canvas" && hasVisuals && !isLoading && (
                      <span className="flex h-2 w-2 items-center justify-center rounded-full bg-brand animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Canvas Body */}
        <div className="flex-1 overflow-y-auto px-10 pb-10 pt-24 chat-scroll relative">
          <div className="mx-auto w-full max-w-4xl pb-20">
            <AnimatePresence mode="wait">
              {activeTab === "canvas" && (
                <motion.div key="canvas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex flex-col gap-10">
                  {isLoading ? (
                    <LoadingState />
                  ) : !response ? (
                    <IdleState />
                  ) : !hasVisuals ? (
                    <NoVisualState />
                  ) : (
                    <div className="flex flex-col gap-10 module-in">
                      {uploadedImage && (
                        <WorkspaceSection title="User Visual Evidence">
                          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-inner group">
                            <img src={uploadedImage} alt="Uploaded evidence" className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/20">
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Live_Input_Node</span>
                            </div>
                          </div>
                        </WorkspaceSection>
                      )}
                      {response.visuals?.map((spec, index) => (
                        <VisualSpecRenderer
                          key={`${spec.kind}-${index}`}
                          spec={spec}
                          refs={response.refs}
                          userQuestion={userQuestion}
                        />
                      ))}
                      
                      {/* Legacy fallback */}
                      {!response.visuals?.length && (
                        <LegacyVisualRenderer response={response} />
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "calculator" && (
                <motion.div key="calculator" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  <WorkspaceSection title="Persistent Load Calculator">
                    <LoadFactorModule rows={dutyCycleRows} />
                  </WorkspaceSection>
                </motion.div>
              )}

              {activeTab === "matrix" && (
                <motion.div key="matrix" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                  <WorkspaceSection title="Process Hierarchy Map">
                    <ProtocolMatrix />
                  </WorkspaceSection>
                </motion.div>
              )}

              {activeTab === "manual" && (
                <motion.div key="manual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex flex-col gap-6">
                  <WorkspaceSection title="Structural Documentation Registry">
                    <div className="grid grid-cols-1 gap-10">
                      {manualImages.map((img) => (
                        <RegistryCard key={img.src} image={img} />
                      ))}
                    </div>
                  </WorkspaceSection>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </aside>
  );
}

function LegacyVisualRenderer({ response }: { response: WorkspaceResponse }) {
  return (
    <>
      {response.visualType === "polarity" && (
        <WorkspaceSection title="Setup Diagram" refs={response.refs}>
          <WiringDiagram process={response.process} />
        </WorkspaceSection>
      )}
      {response.visualType === "duty-cycle" && response.dutyCycleRows && (
        <WorkspaceSection title="Duty Cycle Calculator" refs={response.refs}>
          <LoadFactorModule rows={response.dutyCycleRows} highlightKey={response.highlightContext?.highlightKey} highlightLabel={response.highlightContext?.highlightLabel} />
        </WorkspaceSection>
      )}
      {response.visualType === "process-selection" && (
        <WorkspaceSection title="Process Selection" refs={response.refs}>
          <ProtocolMatrix highlightProcess={response.recommendedProcess} />
        </WorkspaceSection>
      )}
      {response.visualType === "image-diagnosis" && response.imageDiagnosis && (
        <WorkspaceSection title="Image Diagnosis" refs={response.refs}>
          <VisualTelemetry diagnosis={response.imageDiagnosis} reference={response.refs?.[0] ? { title: response.refs[0].title, page: response.refs[0].page } : undefined} />
        </WorkspaceSection>
      )}
      {response.settingRecommendation && (
        <WorkspaceSection title="Settings Recommendation" refs={response.refs}>
          <SettingsRecommendationCard recommendation={response.settingRecommendation} />
        </WorkspaceSection>
      )}
      {response.manualImages?.map((manualImage) => (
        <WorkspaceSection key={manualImage.title} title={manualImage.title} refs={manualImage.refs}>
          <RegistryCard image={manualImage} />
        </WorkspaceSection>
      ))}
    </>
  );
}


function WorkspaceSection({ children, refs, title }: { children: ReactNode; refs?: ManualRef[]; title: string }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/80" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-textSecondary">{title}</h3>
        <div className="h-px flex-1 bg-border/80" />
      </div>
      <div className="rounded-2xl bg-surfaceUp p-6 shadow-sm border border-border/60">
        {children}
        {refs?.length ? (
          <div className="mt-6 pt-4 border-t border-border/60">
            <GroundingNodes refs={refs} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-textSecondary opacity-80 module-in">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-brand/20 border-b-brand animate-[spin_1.5s_linear_infinite_reverse]" />
        <Activity size={24} className="text-brand animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-textPrimary">Rendering Artifact</span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-brand">Generating Geometry...</span>
      </div>
    </div>
  );
}

function IdleState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-textSecondary opacity-60 module-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-surface shadow-sm">
        <Cpu size={28} className="text-textDim" />
      </div>
      <div className="text-center max-w-xs">
        <h3 className="text-sm font-bold text-textPrimary mb-2">Awaiting Telemetry</h3>
        <p className="text-xs leading-relaxed text-textSecondary">
          Upload visual data or input a query to generate interactive diagrams, polarity configurations, or parameter settings.
        </p>
      </div>
    </div>
  );
}

function NoVisualState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-textSecondary opacity-80 module-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber/20 bg-amber/5 text-amber">
        <ShieldAlert size={24} />
      </div>
      <div className="text-center max-w-xs">
        <h3 className="text-sm font-bold text-textPrimary mb-2">Text-Only Response</h3>
        <p className="text-xs leading-relaxed text-textSecondary">
          No graphical artifacts required for this response. See chat for details.
        </p>
      </div>
    </div>
  );
}

function VisualSpecRenderer({ spec, refs, userQuestion }: { spec: VisualSpec; refs?: ManualRef[]; userQuestion?: string; }) {
  if (spec.kind === "setup_diagram") {
    return (
      <WorkspaceSection title="Setup Diagram" refs={refs}>
        <WiringDiagram process={spec.process} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "duty_cycle") {
    return (
      <WorkspaceSection title="Duty Cycle Calculator" refs={refs}>
        <LoadFactorModule rows={spec.rows} highlightKey={spec.highlightKey} highlightLabel={spec.highlightLabel} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "process_matrix") {
    return (
      <WorkspaceSection title="Process Selection" refs={refs}>
        <ProtocolMatrix highlightProcess={spec.recommendedProcess} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "troubleshooting_flow") return null;
  if (spec.kind === "manual_image") {
    return (
      <WorkspaceSection title={spec.image.title} refs={spec.image.refs}>
        <RegistryCard image={spec.image} interpretation={spec.interpretation} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "settings_card") {
    return (
      <WorkspaceSection title="Settings Recommendation" refs={refs}>
        <SettingsRecommendationCard recommendation={spec.recommendation} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "image_diagnosis") {
    return (
      <WorkspaceSection title="Image Diagnosis" refs={refs}>
        <VisualTelemetry diagnosis={spec.diagnosis} reference={spec.reference} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "pre_weld_checklist") return null;
  if (spec.kind === "warnings") {
    return (
      <WorkspaceSection title="Safety Warnings">
        <RiskMitigation warnings={spec.warnings} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "fault_code") {
    return (
      <WorkspaceSection title="Fault Diagnostic" refs={[]}>
        <FaultProtocol fault={spec.fault} />
      </WorkspaceSection>
    );
  }
  return null;
}
