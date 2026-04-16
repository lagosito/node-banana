"use client";

/**
 * El Kiosk — Client Loader
 */

import { useState, useEffect, useCallback } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import type { ClientBrandDNA } from "@/app/api/client/route";
import type { WorkflowFile } from "@/store/workflowStore";

const TIER_WORKFLOWS: Record<string, string> = {
  starter: "/workflows/elkiosk-starter.json",
  essential: "/workflows/elkiosk-essential.json",
  advanced: "/workflows/elkiosk-advanced.json",
};

interface ClientEntry {
  id: string;
  clientName: string;
  firstName: string;
  status: string;
}

function buildBrandPrompt(c: ClientBrandDNA): string {
  return [
    `Brand: ${c.clientName}`,
    `Website: ${c.website}`,
    `Logo: ${c.logo || c.brandLogoUrl || "—"}`,
    ``,
    `Colors:`,
    `  Primary: ${c.primaryColor || "—"}`,
    `  Secondary: ${c.secondaryColor || "—"}`,
    `  Accent: ${c.accentColor || "—"}`,
    `  Dark: ${c.darkColor || "—"}`,
    `  Light: ${c.lightColor || "—"}`,
    ``,
    `Typography:`,
    `  Display: ${c.displayFont || "—"}`,
    `  Body: ${c.bodyFont || "—"}`,
    ``,
    `Tagline: ${c.tagline || "—"}`,
    `Tone: ${c.toneTags || "—"}`,
    `Aesthetic: ${c.aestheticTags || "—"}`,
    ``,
    `Do's: ${c.dos || "—"}`,
    `Don'ts: ${c.donts || "—"}`,
    ``,
    c.customizations ? `Extra notes: ${c.customizations}` : "",
  ].filter((l) => l !== undefined).join("\n").trim();
}

export function ClientLoader() {
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [selectedName, setSelectedName] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("starter");
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingClient, setLoadingClient] = useState(false);
  const [currentClient, setCurrentClient] = useState<ClientBrandDNA | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { nodes, updateNodeData, loadWorkflow } = useWorkflowStore((state) => ({
    nodes: state.nodes,
    updateNodeData: state.updateNodeData,
    loadWorkflow: state.loadWorkflow,
  }));

  useEffect(() => {
    if (!isOpen) return;
    setLoadingClients(true);
    fetch("/api/client")
      .then((r) => r.json())
      .then((data) => { setClients(data.clients || []); setLoadingClients(false); })
      .catch(() => { setError("Failed to load clients from Airtable"); setLoadingClients(false); });
  }, [isOpen]);

  const injectBrandDNA = useCallback((client: ClientBrandDNA) => {
    const brandPrompt = buildBrandPrompt(client);
    const brandNode = nodes.find(
      (n) => n.type === "prompt" && (n.data as { variableName?: string }).variableName === "brand_context"
    );
    if (brandNode) { updateNodeData(brandNode.id, { prompt: brandPrompt } as never); }
    else { console.warn("[ElKiosk] No 'brand_context' prompt node found"); }
  }, [nodes, updateNodeData]);

  const handleLoadClient = useCallback(async () => {
    if (!selectedName) return;
    setLoadingClient(true); setError(null);
    try {
      const res = await fetch(`/api/client?name=${encodeURIComponent(selectedName)}`);
      const data = await res.json();
      if (!res.ok || !data.client) throw new Error(data.error || "Client not found");
      const client: ClientBrandDNA = data.client;
      setCurrentClient(client);
      const workflowUrl = TIER_WORKFLOWS[selectedTier];
      if (workflowUrl) {
        const wRes = await fetch(workflowUrl);
        if (wRes.ok) {
          const workflow = (await wRes.json()) as WorkflowFile;
          workflow.name = `${client.clientName} — ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}`;
          await loadWorkflow(workflow);
          setTimeout(() => { injectBrandDNA(client); }, 100);
        }
      } else { injectBrandDNA(client); }
      setIsOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setLoadingClient(false); }
  }, [selectedName, selectedTier, loadWorkflow, injectBrandDNA]);

  const handleInjectOnly = useCallback(async () => {
    if (!selectedName) return;
    setLoadingClient(true); setError(null);
    try {
      const res = await fetch(`/api/client?name=${encodeURIComponent(selectedName)}`);
      const data = await res.json();
      if (!res.ok || !data.client) throw new Error(data.error || "Client not found");
      setCurrentClient(data.client);
      injectBrandDNA(data.client);
      setIsOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setLoadingClient(false); }
  }, [selectedName, injectBrandDNA]);

  const tierLabel: Record<string, string> = {
    starter: "🌱 Starter (€349 — 10 posts)",
    essential: "⭐ Essential (€599 — 20 posts)",
    advanced: "🚀 Advanced (€999 — 40+ posts)",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-yellow-400 hover:bg-yellow-300 text-black transition-colors"
        title="Load El Kiosk Client"
      >
        🍌 {currentClient ? currentClient.clientName : "Load Client"}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">🍌 El Kiosk — Client Loader</h3>
            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white text-lg leading-none">×</button>
          </div>
          {error && <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300">{error}</div>}
          <div className="mb-3">
            <label className="block text-xs text-zinc-400 mb-1">Client</label>
            {loadingClients ? <div className="text-xs text-zinc-500">Loading clients…</div> : (
              <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-400">
                <option value="">— Select client —</option>
                {clients.map((c) => <option key={c.id} value={c.clientName}>{c.clientName}{c.status ? ` (${c.status})` : ""}</option>)}
              </select>
            )}
          </div>
          <div className="mb-4">
            <label className="block text-xs text-zinc-400 mb-1">Tier / Workflow</label>
            <select value={selectedTier} onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-400">
              {Object.entries(tierLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleLoadClient} disabled={!selectedName || loadingClient}
              className="flex-1 py-2 rounded-md text-sm font-medium bg-yellow-400 hover:bg-yellow-300 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {loadingClient ? "Loading…" : "Load Workflow + Brand"}
            </button>
            <button onClick={handleInjectOnly} disabled={!selectedName || loadingClient}
              className="px-3 py-2 rounded-md text-sm bg-zinc-700 hover:bg-zinc-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Inject Brand DNA into current workflow without changing template">DNA only</button>
          </div>
          {currentClient && (
            <div className="mt-4 p-3 bg-zinc-800 rounded-lg text-xs space-y-1 text-zinc-300">
              <div className="font-semibold text-white text-sm mb-2">✅ {currentClient.clientName}</div>
              <div className="flex gap-2 flex-wrap">
                {[currentClient.primaryColor, currentClient.secondaryColor, currentClient.accentColor].filter(Boolean).map((color, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full border border-zinc-600 inline-block" style={{ backgroundColor: color }} />
                    <span className="text-zinc-400">{color}</span>
                  </span>
                ))}
              </div>
              {currentClient.toneTags && <div><span className="text-zinc-500">Tone:</span> {currentClient.toneTags}</div>}
              {currentClient.displayFont && <div><span className="text-zinc-500">Font:</span> {currentClient.displayFont}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
