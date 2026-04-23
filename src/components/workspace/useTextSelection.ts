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

      // Ensure selection is within the target container
      if (!containerRef.current.contains(selection.anchorNode)) {
        setSelectionData(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const frag = range.cloneContents();
      
      // Use cloneContents() as it's more reliable for cross-container block selections than toString()
      let text = frag.textContent || selection.toString();
      text = text.replace(/\n\s*\n/g, '\n').trim();

      if (!text) {
        setSelectionData(null);
        return;
      }

      const rects = Array.from(range.getClientRects());
      if (rects.length === 0) {
        setSelectionData(null);
        return;
      }

      // If the user drags from empty margin space, the browser bounds start at the margin wrappers,
      // creating massive empty rectangles located physically at the top of the page.
      // We filter linearly through document order to find the first rectangle shaped like a text line!
      const firstTextRect = rects.find(r => r.height > 0 && r.height < 80);
      if (!firstTextRect) {
        setSelectionData(null);
        return;
      }

      let startNode = range.startContainer;
      let startElement = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode as HTMLElement;
      let pageElement = startElement?.closest('.react-pdf__Page') as HTMLElement;

      if (!pageElement) {
        pageElement = selection.anchorNode?.parentElement?.closest('.react-pdf__Page') as HTMLElement;
      }

      let pageNumber = 1;
      let topPercent = 0;
      let heightPercent = 0;

      if (pageElement) {
        const pageRect = pageElement.getBoundingClientRect();
        pageNumber = parseInt(pageElement.dataset.pageNumber || "1", 10);
        if (isNaN(pageNumber)) pageNumber = 1;

        const absoluteTop = firstTextRect.top - pageRect.top;

        // Ensure we don't wildly miscalculate height if selection jumps pages
        const validRects = rects.filter(r => r.height > 0 && r.height < 80);
        const lastTextRect = validRects[validRects.length - 1];
        
        const absoluteHeight = Math.max(0, lastTextRect.bottom - firstTextRect.top);

        topPercent = (absoluteTop / pageRect.height) * 100;
        heightPercent = (absoluteHeight / pageRect.height) * 100;
      }

      setSelectionData({
        text,
        pageNumber,
        topPercent,
        heightPercent,
        viewportTop: firstTextRect.top,
        viewportLeft: firstTextRect.left + (firstTextRect.width / 2)
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [containerRef]);

  return { selectionData, clearSelection: () => setSelectionData(null) };
}
