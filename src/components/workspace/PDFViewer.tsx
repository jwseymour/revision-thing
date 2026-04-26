"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { createClient } from "@/lib/supabase/client";
import { useTextSelection } from "./useTextSelection";
import { FloatingToolbar } from "./FloatingToolbar";
import { FlashcardGeneratorModal } from "./FlashcardGeneratorModal";
import { CommentModal } from "./CommentModal";
import { ViewCommentModal } from "./ViewCommentModal";
import { updateSchedule } from "@/lib/scheduling";
import { preprocessLaTeX } from "@/lib/math-utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
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
  moduleName: string;
  flashcards: any[];
  annotations: any[];
  onRefresh: () => void;
}

export function PDFViewer({ filePath, resourceId, moduleName, flashcards, annotations, onRefresh }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRestoringScroll = useRef(true);
  const supabase = createClient();
  
  const { selectionData, clearSelection } = useTextSelection(containerRef);
  const [modalSelection, setModalSelection] = useState<any | null>(null);
  const [commentSelection, setCommentSelection] = useState<any | null>(null);
  
  // States for viewing items
  const [activeViewCard, setActiveViewCard] = useState<any | null>(null);
  const [activeViewAnnotation, setActiveViewAnnotation] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteFlashcard = async (id: string) => {
    if (!confirm("Are you sure you want to delete this flashcard?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/content/flashcards/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setActiveViewCard(null);
        onRefresh();
      } else {
        alert("Failed to delete flashcard");
      }
    } catch (e) {
      alert("Error deleting flashcard");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGrade = async (quality: number) => {
    if (!activeViewCard) return;
    
    let classification = "incorrect";
    if (quality === 3) classification = "partial";
    if (quality === 4) classification = "correct_guessed";
    if (quality === 5) classification = "correct_confident";

    const card = activeViewCard;
    setActiveViewCard(null); // Optimistic close

    const { data: { user } } = await supabase.auth.getUser();
    if (user && card) {
      // 1. Log attempt
      await supabase.from("attempts").insert({
        user_id: user.id,
        item_id: card.id,
        item_type: "flashcard",
        classification,
      });
      
      // 2. Schedule algorithm (SM-2/FSRS) Update
      await updateSchedule(supabase, user.id, card.module, card.id, "flashcard", classification);
      
      // 3. Refresh marginalia bar visuals
      onRefresh();
    }
  };

  // Group and Layout items per-page to resolve collisions
  const trackItemsByPage = useMemo(() => {
    const itemsMap = new Map<number, any[]>();
    
    // Page height is roughly standardized in absolute scale if we use 800px width.
    // Page height is roughly standardized in absolute scale if we use 800px width.
    // Assuming ~1100px height. A marginalia card is ~80px = ~7% height.
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
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + E to Generate Flashcard from selection
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        if (selectionData) {
          e.preventDefault();
          setModalSelection(selectionData);
          clearSelection();
        }
      }
      
      // Cmd/Ctrl + M to Add Comment from selection
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        if (selectionData) {
          e.preventDefault();
          setCommentSelection(selectionData);
          clearSelection();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectionData, clearSelection]);

  useEffect(() => {
    // Generate a signed URL from Supabase Storage (60-minute expiry)
    supabase.storage
      .from("resources")
      .createSignedUrl(filePath, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) {
          setError(`Failed to load document: ${error?.message ?? "Unknown error"}`);
        } else {
          setFileUrl(data.signedUrl);
        }
      });
  }, [filePath, supabase]);

  useEffect(() => {
    if (!containerRef.current || !numPages) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (isRestoringScroll.current) return; // Prevent overwriting during initial mount restoration

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = entry.target.getAttribute('data-page-number');
            if (pageNum) {
              localStorage.setItem(`pdf_page_${resourceId}`, pageNum);
            }
          }
        });
      },
      { threshold: 0.2 } // Trigger if 20% of page is visible
    );

    // Wait slightly for DOM to settle
    setTimeout(() => {
       const wrappers = containerRef.current?.querySelectorAll(`[data-page-number]`);
       wrappers?.forEach(w => observer.observe(w));
    }, 100);

    return () => observer.disconnect();
  }, [numPages, zoom, resourceId]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    
    // Resume scroll after rendering
    setTimeout(() => {
      const lastPage = localStorage.getItem(`pdf_page_${resourceId}`);
      if (lastPage && containerRef.current) {
        const target = containerRef.current.querySelector(`[data-page-number="${lastPage}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }
      
      // Allow observer to state-track again after the scroll has settled
      setTimeout(() => {
         isRestoringScroll.current = false;
      }, 500);
      
    }, 500);
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
      <div className={styles.zoomControls}>
        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>−</button>
        <span style={{ minWidth: "40px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}>+</button>
      </div>

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
          moduleName={moduleName}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => handleDeleteFlashcard(activeViewCard.id)} 
                  disabled={isDeleting}
                  style={{ background: 'none', border: '1px solid var(--status-error)', color: 'var(--status-error)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  {isDeleting ? '...' : 'Delete'}
                </button>
                <button className={styles.closeBtn} onClick={() => setActiveViewCard(null)}>✕</button>
              </div>
            </div>
            <div className={styles.content}>
               <div className="markdown-body" style={{ marginBottom: "var(--space-md)", color: "var(--text-primary)", fontSize: "1.1rem", fontWeight: "bold" }}>
                 <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(activeViewCard.front)}</ReactMarkdown>
               </div>
               <hr style={{ border: "none", borderTop: "1px solid var(--border-default)", margin: "var(--space-md) 0" }} />
               <div className="markdown-body" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                 <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(activeViewCard.back)}</ReactMarkdown>
               </div>
               
               <div className={styles.gradingControls}>
                 <button className={`btn btn-sm ${styles.gradeBtn} ${styles.again}`} onClick={() => handleGrade(1)}>Again</button>
                 <button className={`btn btn-sm ${styles.gradeBtn} ${styles.hard}`} onClick={() => handleGrade(3)}>Hard</button>
                 <button className={`btn btn-sm ${styles.gradeBtn} ${styles.good}`} onClick={() => handleGrade(4)}>Good</button>
                 <button className={`btn btn-sm ${styles.gradeBtn} ${styles.easy}`} onClick={() => handleGrade(5)}>Easy</button>
               </div>
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
              <div className={styles.pageWrapper} data-page-number={index + 1}>
                <Page
                  pageNumber={index + 1}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  className={styles.page}
                  width={800 * zoom} // Scale according to zoom
                />
              </div>

              {/* Marginalia Track natively bound to the page height */}
              <div className={styles.marginaliaTrack} style={{ width: `${300 * zoom}px` }}>
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
                        style={{ 
                          top: `${actualTopPercent}%`, 
                          borderLeftColor: easeColor, 
                          cursor: "pointer",
                          "--pdf-zoom": zoom,
                          width: '300px',
                          marginTop: '-16px'
                        } as React.CSSProperties}
                        onClick={() => setActiveViewCard(item)}
                      >
                        <div className={styles.marginaliaHeader}>
                          <span>🗂️ Flashcard ({item.card_type})</span>
                        </div>
                        <strong>Q:</strong> <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: 'span' }}>{preprocessLaTeX(item.front)}</ReactMarkdown>
                      </div>
                    );
                  } else {
                    return (
                      <div 
                        key={`ann-${item.id}`}
                        className={styles.marginaliaCard}
                        style={{ 
                          top: `${actualTopPercent}%`, 
                          borderLeftColor: "#ffeb3b", 
                          cursor: "pointer",
                          "--pdf-zoom": zoom,
                          width: '300px',
                          marginTop: '-16px'
                        } as React.CSSProperties}
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
