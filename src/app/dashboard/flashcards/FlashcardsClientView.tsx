"use client";

import { useActiveModule } from "../ModuleContext";
import { FlashcardLibrary } from "./FlashcardLibrary";
import { DynamicSplitView } from "@/components/DynamicSplitView";

export function FlashcardsClientView({ flashcards }: { flashcards: any[] }) {
  const { activeModule } = useActiveModule();

  if (!activeModule) {
    return (
      <div style={{ padding: "var(--space-2xl)", maxWidth: "var(--max-content-width)", margin: "0 auto", textAlign: "center", marginTop: "10vh" }}>
        <h2>Flashcards Library</h2>
        <p className="text-muted">Please select a module from the sidebar to view its associated flashcards.</p>
      </div>
    );
  }

  const filteredCards = flashcards.filter(c => c.module === activeModule);

  return (
    <div style={{ height: "100%", display: "flex", flex: 1 }}>
      <DynamicSplitView moduleName={activeModule}>
        <div className="page-content" style={{ padding: "var(--space-2xl)", maxWidth: "var(--max-content-width)", margin: "0 auto" }}>
          <div style={{ marginBottom: "var(--space-2xl)" }}>
            <h1><span className="accent-text">{activeModule}</span> Flashcards</h1>
            <p className="text-muted">Manage your Socratic flashcards derived from your notes.</p>
          </div>
          <FlashcardLibrary initialCards={filteredCards} />
        </div>
      </DynamicSplitView>
    </div>
  );
}
