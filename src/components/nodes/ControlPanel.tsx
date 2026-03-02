"use client";

import { useMemo } from "react";
import { Node } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflowStore";
import { NodeType } from "@/types";

// List of node types that have configurable parameters
const CONFIGURABLE_NODE_TYPES: NodeType[] = [
  "nanoBanana",
  "generateVideo",
  "generate3d",
  "generateAudio",
  "llmGenerate",
  "easeCurve",
  "conditionalSwitch",
];

/**
 * Fixed-position control panel on the right side of viewport
 * Displays controls for the currently selected node
 */
export function ControlPanel() {
  const nodes = useWorkflowStore((state) => state.nodes);

  // Get the single selected node
  const selectedNode = useMemo(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length !== 1) return null;
    return selected[0];
  }, [nodes]);

  // Check if the selected node is configurable
  const isConfigurable = selectedNode && CONFIGURABLE_NODE_TYPES.includes(selectedNode.type as NodeType);

  // If no single node selected or not configurable, hide panel
  if (!selectedNode || !isConfigurable) {
    return null;
  }

  return (
    <div className="fixed top-0 right-6 h-screen z-[50] flex items-center pointer-events-none">
      <div className="w-80 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl max-h-[80vh] overflow-y-auto pointer-events-auto transition-opacity duration-200 nowheel">
        <div className="p-4">
          {/* Header */}
          <h3 className="text-sm font-medium text-neutral-200 mb-4">
            {getNodeTypeTitle(selectedNode.type as NodeType)}
          </h3>

          {/* Node-specific controls */}
          <div className="space-y-4">
            {selectedNode.type === "nanoBanana" && (
              <GenerateImageControls node={selectedNode} />
            )}
            {selectedNode.type === "generateVideo" && (
              <GenerateVideoControls node={selectedNode} />
            )}
            {selectedNode.type === "generate3d" && (
              <Generate3DControls node={selectedNode} />
            )}
            {selectedNode.type === "generateAudio" && (
              <GenerateAudioControls node={selectedNode} />
            )}
            {selectedNode.type === "llmGenerate" && (
              <LLMControls node={selectedNode} />
            )}
            {selectedNode.type === "easeCurve" && (
              <EaseCurveControls node={selectedNode} />
            )}
            {selectedNode.type === "conditionalSwitch" && (
              <ConditionalSwitchControls node={selectedNode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getNodeTypeTitle(type: NodeType): string {
  const titles: Record<string, string> = {
    nanoBanana: "Generate Image Settings",
    generateVideo: "Generate Video Settings",
    generate3d: "Generate 3D Settings",
    generateAudio: "Generate Audio Settings",
    llmGenerate: "LLM Settings",
    easeCurve: "Ease Curve Settings",
    conditionalSwitch: "Conditional Switch Settings",
  };
  return titles[type] || "Settings";
}

// Placeholder components for each node type (Task 2 will implement these fully)
function GenerateImageControls({ node }: { node: Node }) {
  return (
    <div className="text-xs text-neutral-400">
      Settings for {node.type}
    </div>
  );
}

function GenerateVideoControls({ node }: { node: Node }) {
  return (
    <div className="text-xs text-neutral-400">
      Settings for {node.type}
    </div>
  );
}

function Generate3DControls({ node }: { node: Node }) {
  return (
    <div className="text-xs text-neutral-400">
      Settings for {node.type}
    </div>
  );
}

function GenerateAudioControls({ node }: { node: Node }) {
  return (
    <div className="text-xs text-neutral-400">
      Settings for {node.type}
    </div>
  );
}

function LLMControls({ node }: { node: Node }) {
  return (
    <div className="text-xs text-neutral-400">
      Settings for {node.type}
    </div>
  );
}

function EaseCurveControls({ node }: { node: Node }) {
  return (
    <div className="text-xs text-neutral-400">
      Settings for {node.type}
    </div>
  );
}

function ConditionalSwitchControls({ node }: { node: Node }) {
  return (
    <div className="text-xs text-neutral-400">
      Settings for {node.type}
    </div>
  );
}
