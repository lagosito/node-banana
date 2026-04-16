"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { ReactFlowProvider } from "@xyflow/react";
import { Header } from "@/components/Header";
import { useWorkflowStore } from "@/store/workflowStore";

// WorkflowCanvas pulls in Three.js (GLBViewerNode) and Konva (AnnotationModal)
// both of which call document.createElement at import time and crash during SSR.
const WorkflowCanvas = dynamic(
  () => import("@/components/WorkflowCanvas").then((m) => m.WorkflowCanvas),
  { ssr: false }
);

const FloatingActionBar = dynamic(
  () => import("@/components/FloatingActionBar").then((m) => m.FloatingActionBar),
  { ssr: false }
);

const AnnotationModal = dynamic(
  () => import("@/components/AnnotationModal").then((m) => m.AnnotationModal),
  { ssr: false }
);

export default function Home() {
  const initializeAutoSave = useWorkflowStore(
    (state) => state.initializeAutoSave
  );
  const cleanupAutoSave = useWorkflowStore((state) => state.cleanupAutoSave);

  useEffect(() => {
    initializeAutoSave();
    return () => cleanupAutoSave();
  }, [initializeAutoSave, cleanupAutoSave]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useWorkflowStore.getState().hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col">
        <Header />
        <WorkflowCanvas />
        <FloatingActionBar />
        <AnnotationModal />
      </div>
    </ReactFlowProvider>
  );
}
