"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { createClient } from "@/lib/supabase/client";
import { useTextSelection } from "./useTextSelection";
import { FloatingToolbar } from "./FloatingToolbar";
import { FlashcardGeneratorModal } from "./FlashcardGeneratorModal";
import { CommentModal } from "./CommentModal";
import { ViewCommentModal } from "./ViewCommentModal";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import styles from "./PDFViewer.module.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Suppress known harmless AbortException errors from react-pdf text layer rendering
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('AbortException')) return;
  // Also catch Error objects
  if (args[0] && args[0].name === 'AbortException') return;
  originalConsoleError.apply(console, args);
};
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('AbortException')) return;
  originalConsoleWarn.apply(console, args);
};

interface PDFViewerProps {
  filePath: string;
  resourceId: string;
  flashcards: any[];
  annotations: any[];
  onRefresh: () => void;
}

export function PDFViewer({ filePath, resourceId, flashcards, annotations, onRefresh }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  
  const { selectionData, clearSelection } = useTextSelection(containerRef);
  const [modalSelection, setModalSelection] = useState<any | null>(null);
  const [commentSelection, setCommentSelection] = useState<any | null>(null);
  
  // States for viewing items
  const [activeViewCard, setActiveViewCard] = useState<any | null>(null);
  const [activeViewAnnotation, setActiveViewAnnotation] = useState<any | null>(null);

  // Group and Layout items per-page to resolve collisions
  const trackItemsByPage = useMemo(() => {
    const itemsMap = new Map<number, any[]>();
    
    // Page height is roughly standardized in absolute scale if we use 800px width.
    // Assuming ~1000px height. A marginalia card is ~100px = ~10% height.
    const gapPercent = 10; 

    const processItem = (item: any, type: 'flashcard' | 'annotation') => {
      const rawData = item.source_rects;
      let pageNumber = 1;
      let topPercent = 0;

      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        pageNumber = rawData.pageNumber || 1;
        if (rawData.topPercent !== undefined) {
           topPercent = Number(rawData.topPercent) || 0;
        } else if (rawData.rects && rawData.rects.length > 0) {
           topPercent = (Number(rawData.rects[0].top) / 1000) * 100 || 0; 
        }
      } else if (Array.isArray(rawData) && rawData.length > 0) {
        topPercent = Math.max(0, (Number(rawData[0].top) / 1000) * 100 || 0); 
      }

      if (isNaN(topPercent)) topPercent = 0;
      if (isNaN(pageNumber)) pageNumber = 1;

      if (!itemsMap.has(pageNumber)) itemsMap.set(pageNumber, []);
      itemsMap.get(pageNumber)!.push({ item, type, topPercent });
    };

    (flashcards || []).forEach(fc => processItem(fc, 'flashcard'));
    (annotations || []).forEach(ann => processItem(ann, 'annotation'));

    // Sort and run layout per page
    itemsMap.forEach((items, pageNum) => {
      items.sort((a, b) => a.topPercent - b.topPercent);
      
      let currentMinTop = 0;
      items.forEach(i => {
         i.actualTopPercent = Math.max(currentMinTop, i.topPercent);
         currentMinTop = i.actualTopPercent + gapPercent; // Push next item down
      });
    });

    return itemsMap;
  }, [flashcards, annotations]);

  useEffect(() => {
    // Files are uploaded to local `public/resources/...` so `filePath` is accessible via `/${filePath}`
    setFileUrl(`/${filePath}`);
  }, [filePath]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  // Optimize page rendering options
  const loadingElement = (
    <div className={styles.loading}>
      <div className="spinner"></div>
      <p>Loading document...</p>
    </div>
  );

  return (
    <div className={styles.viewerContainer} ref={containerRef}>
      {error && <div className={styles.error}>{error}</div>}
      
      {!fileUrl && !error && loadingElement}

      <FloatingToolbar 
        selectionData={selectionData} 
        onCreateFlashcard={() => {
          setModalSelection(selectionData);
          clearSelection();
        }}
        onAddComment={() => {
          setCommentSelection(selectionData);
          clearSelection();
        }}
      />

      {modalSelection && (
        <FlashcardGeneratorModal
          selectionData={modalSelection}
          resourceId={resourceId}
          moduleName={"Module"} // TODO: Pass real module name down to PDFViewer props
          onClose={() => setModalSelection(null)}
          onSuccess={() => {
            setModalSelection(null);
            onRefresh(); // Refresh after creation
          }}
        />
      )}

      {commentSelection && (
        <CommentModal
          selectionData={commentSelection}
          resourceId={resourceId}
          onClose={() => setCommentSelection(null)}
          onSuccess={() => {
            setCommentSelection(null);
            onRefresh(); // Refresh to get new annotations
          }}
        />
      )}

      {activeViewCard && (
        <div className={styles.overlay} onClick={() => setActiveViewCard(null)}>
          <div className={styles.viewModal} onClick={e => e.stopPropagation()}>
            <div className={styles.header}>
              <h3>Flashcard ({activeViewCard.card_type})</h3>
              <button className={styles.closeBtn} onClick={() => setActiveViewCard(null)}>✕</button>
            </div>
            <div className={styles.content}>
               <h3 style={{ marginBottom: "var(--space-md)", color: "var(--text-primary)" }}>{activeViewCard.front}</h3>
               <hr style={{ border: "none", borderTop: "1px solid var(--border-default)", margin: "var(--space-md) 0" }} />
               <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{activeViewCard.back}</div>
            </div>
          </div>
        </div>
      )}

      {activeViewAnnotation && (
        <ViewCommentModal
          annotation={activeViewAnnotation}
          onClose={() => setActiveViewAnnotation(null)}
          onSuccess={() => {
            setActiveViewAnnotation(null);
            onRefresh();
          }}
        />
      )}

      {fileUrl && (
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={loadingElement}
          className={styles.document}
        >
          {Array.from(new Array(numPages || 0), (el, index) => (
            <div key={`page_${index + 1}`} style={{ display: 'flex', gap: '32px', position: 'relative', alignItems: 'stretch' }}>
              <div className={styles.pageWrapper}>
                <Page
                  pageNumber={index + 1}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  className={styles.page}
                  width={800} // Set a fixed width for consistent rendering, or make it responsive
                />
              </div>

              {/* Marginalia Track natively bound to the page height */}
              <div className={styles.marginaliaTrack}>
                {(trackItemsByPage.get(index + 1) || []).map(({ item, type, actualTopPercent }, i) => {
                  if (type === 'flashcard') {
                    const sched = item.item_scheduling_state?.[0];
                    let easeColor = "var(--text-tertiary)";
                    if (sched) {
                      if (sched.stability >= 20) easeColor = "var(--status-success)";
                      else if (sched.stability < 5) easeColor = "var(--status-error)";
                      else easeColor = "var(--status-warning)";
                    }
                    
                    return (
                      <div 
                        key={`fc-${item.id}`}
                        className={styles.marginaliaCard}
                        style={{ top: `${actualTopPercent}%`, borderLeftColor: easeColor, cursor: "pointer" }}
                        onClick={() => setActiveViewCard(item)}
                      >
                        <div className={styles.marginaliaHeader}>
                          <span>🗂️ Flashcard ({item.card_type})</span>
                        </div>
                        <strong>Q:</strong> {item.front}
                      </div>
                    );
                  } else {
                    return (
                      <div 
                        key={`ann-${item.id}`}
                        className={styles.marginaliaCard}
                        style={{ top: `${actualTopPercent}%`, borderLeftColor: "#ffeb3b", cursor: "pointer" }}
                        onClick={() => setActiveViewAnnotation(item)}
                      >
                        <div className={styles.marginaliaHeader}>
                          <span>💬 Comment</span>
                        </div>
                        {item.content.length > 80 ? item.content.substring(0, 80) + "..." : item.content}
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          ))}

        </Document>
      )}
    </div>
  );
}
