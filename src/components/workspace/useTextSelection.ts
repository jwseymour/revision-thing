"use client";

import { useState, useEffect } from "react";

export interface SelectionData {
  text: string;
  pageNumber: number;
  topPercent: number;    // % top offset relative to the page
  heightPercent: number; // % height of the combined selection
  viewportTop: number;   // fixed CSS top for the toolbar
  viewportLeft: number;  // fixed CSS left for the toolbar
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selectionData, setSelectionData] = useState<SelectionData | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();

      // Clear if empty or outside container
      if (!selection || selection.isCollapsed || !containerRef.current) {
        setSelectionData(null);
        return;
      }

      // Ensure selection is within the PDF text layer
      if (!containerRef.current.contains(selection.anchorNode)) {
        setSelectionData(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setSelectionData(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rects = Array.from(range.getClientRects());

      const pageElement = selection.anchorNode?.parentElement?.closest('.react-pdf__Page') as HTMLElement;
      if (!pageElement) {
        setSelectionData(null);
        return;
      }
      
      const pageRect = pageElement.getBoundingClientRect();
      let pageNumber = parseInt(pageElement.dataset.pageNumber || "1", 10);
      if (isNaN(pageNumber)) pageNumber = 1;

      // Find the absolute min/max Y coordinates from all rects in the selection
      const minTop = Math.min(...rects.map(r => r.top));
      const maxBottom = Math.max(...rects.map(r => r.bottom));
      
      const absoluteTop = minTop - pageRect.top;
      const absoluteHeight = maxBottom - minTop;

      const topPercent = (absoluteTop / pageRect.height) * 100;
      const heightPercent = (absoluteHeight / pageRect.height) * 100;

      setSelectionData({
        text,
        pageNumber,
        topPercent,
        heightPercent,
        viewportTop: rects[0].top,
        viewportLeft: rects[0].left + (rects[0].width / 2)
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [containerRef]);

  return { selectionData, clearSelection: () => setSelectionData(null) };
}
