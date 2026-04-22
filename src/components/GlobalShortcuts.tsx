"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function GlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Check for modifier + key combinations
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Keyboard Shortcuts Reference Modal (Cmd/Ctrl + /)
      if (isCmdOrCtrl && key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-shortcuts-modal"));
        return;
      }

      // Toggle AI Supervisor (Cmd/Ctrl + .)
      if (isCmdOrCtrl && key === ".") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-supervisor"));
        return;
      }

      // Shift + [Key] for Global Navigation
      if (isShift && !isCmdOrCtrl && !e.altKey) {
        switch (key) {
          case "r":
            e.preventDefault();
            router.push("/dashboard/review");
            break;
          case "a":
            e.preventDefault();
            router.push("/dashboard/analytics");
            break;
          case "n":
            e.preventDefault();
            router.push("/dashboard");
            break;
          case "f":
            e.preventDefault();
            router.push("/dashboard/flashcards");
            break;
          case "s":
            e.preventDefault();
            router.push("/dashboard/supervisor");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
