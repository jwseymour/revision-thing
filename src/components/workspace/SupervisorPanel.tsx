"use client";

import styles from "./SupervisorPanel.module.css";
import { useEffect, useRef, useState, FormEvent, ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { preprocessLaTeX } from "@/lib/math-utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useTextSelection } from "./useTextSelection";
import { FlashcardGeneratorModal } from "./FlashcardGeneratorModal";

interface SupervisorPanelProps {
  resourceId?: string;
  moduleName: string;
  explicitSessionId?: string;
  hasPastPaper: boolean;
  onTabSwitch: (tab: "past_paper" | "supervisor") => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Session {
  id: string;
  openai_thread_id: string;
  created_at: string;
}

function SupervisorChat({ 
  moduleName, 
  threadId
}: { 
  moduleName: string; 
  threadId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true); // Loading history initially
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Audio state
  const [isListening, setIsListening] = useState(false);
  const [activeSpeechMsgId, setActiveSpeechMsgId] = useState<string | null>(null);
  const [autoReadEnabled, setAutoReadEnabled] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("supervisor_speech_speed");
      return saved ? parseFloat(saved) : 2;
    }
    return 2;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isListeningRef = useRef(false);
  const isMicSuspendedRef = useRef(false);
  const autoReadRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync ref for callback closures
  useEffect(() => {
    autoReadRef.current = autoReadEnabled;
  }, [autoReadEnabled]);

  // Persist speech speed
  useEffect(() => {
    localStorage.setItem("supervisor_speech_speed", String(speechSpeed));
  }, [speechSpeed]);

  // Load history
  useEffect(() => {
    async function fetchHistory() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/supervisor/messages?threadId=${threadId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
             setMessages(data.messages);
          } else {
             // Default greeting if empty
             setMessages([{ id: crypto.randomUUID(), role: "assistant", content: `Hello! I am your AI Supervisor for **${moduleName}**. What would you like to discuss today?` }]);
          }
        } else {
          throw new Error("Failed to load history.");
        }
      } catch (err) {
        console.error(err);
        setMessages([{ id: crypto.randomUUID(), role: "assistant", content: `Hello! I am your AI Supervisor for **${moduleName}**. What would you like to discuss today?` }]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
    
    return () => {
      // stop TTS on unmount/thread switch
      stopAudio(); 
      if (recognitionRef.current) {
         isListeningRef.current = false;
         recognitionRef.current.stop();
      }
    };
  }, [threadId, moduleName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize: reset then expand to content
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && input.trim()) {
        const text = input;
        setInput("");
        // Reset height after clearing
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        doSend(text);
      }
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition isn't supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let currentFinal = ""; // Track final results locally per continuous session

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
    };
    
    recognition.onresult = (event: any) => {
      let interim = '';
      let chunk = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          chunk += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      currentFinal += chunk;
      const composite = (currentFinal + " " + interim).replace(/\s+/g, ' ').trim();
      setInput(composite);

      const lower = composite.toLowerCase();
      // Check for hotword trigger
      if (lower.endsWith("send message") || lower.endsWith(" over")) {
          // Send immediately
          let clean = composite.replace(/send message$/i, "").replace(/ over$/i, "").trim();
          setInput("");
          currentFinal = "";
          
          if (clean && !isGenerating) {
             doSend(clean);
          }
      }
    };
    
    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
         isListeningRef.current = false;
         setIsListening(false);
      }
    };
    
    recognition.onend = () => {
       if (isListeningRef.current && !isMicSuspendedRef.current) {
           // Browser stopped it due to silence, silently restart
           try { recognition.start(); } catch(e){}
       } else if (!isListeningRef.current) {
           setIsListening(false);
       }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const toggleMic = () => {
    if (isListeningRef.current) stopListening();
    else startListening();
  };

  const suspendMic = () => {
    isMicSuspendedRef.current = true;
    try { recognitionRef.current?.stop(); } catch(e) {}
  };

  const resumeMic = () => {
    isMicSuspendedRef.current = false;
    if (isListeningRef.current) {
      try { recognitionRef.current?.start(); } catch(e) {}
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setActiveSpeechMsgId(null);
    resumeMic();
  };

  const speakText = async (msgId: string, text: string) => {
    stopAudio();
    if (activeSpeechMsgId === msgId) {
       // Mute toggle if clicked while playing
       return;
    }
    
    setActiveSpeechMsgId(msgId);
    let cleanText = text.replace(/[#*`_]/g, '');
    cleanText = cleanText.replace(/\$\$.*?\$\$/g, ' math equation ');
    
    try {
        const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleanText })
        });
        
        if (!res.ok) throw new Error("TTS failed");
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        
        const audio = new Audio(url);
        audio.playbackRate = speechSpeed;
        audioRef.current = audio;
        
        suspendMic();
        
        return new Promise<void>((resolve) => {
            audio.onended = () => {
               setActiveSpeechMsgId(null);
               resumeMic();
               resolve();
            };
            audio.play().catch((e) => {
               console.error("Audio play failed:", e);
               setActiveSpeechMsgId(null);
               resumeMic();
               resolve();
            });
        });
    } catch (e) {
        console.error("OpenAI TTS error:", e);
        setActiveSpeechMsgId(null);
        resumeMic();
    }
  };

  const doSend = async (userMessage: string) => {
    if (!userMessage.trim() || isGenerating) return;

    // Temporarily pause mic if it's on, to prevent it from hearing the TTS
    suspendMic();
    stopAudio();

    setErrorMsg(null);
    setIsGenerating(true);

    const userMsgObj: Message = { id: crypto.randomUUID(), role: "user", content: userMessage };
    setMessages(prev => [...prev, userMsgObj]);

    let accumulatedResponse = "";
    const assistantMsgId = crypto.randomUUID();

    try {
      const response = await fetch("/api/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleName,
          topic: moduleName,
          threadId: threadId,
          message: userMessage
        })
      });

      if (!response.ok) {
        let errStr = response.statusText;
        try { errStr = await response.text(); } catch(e){}
        throw new Error(errStr);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;

        setMessages(prev => prev.map(m => 
          m.id === assistantMsgId ? { ...m, content: accumulatedResponse } : m
        ));
      }

    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error communicating with server.");
    } finally {
      setIsGenerating(false);
      
      // Auto-read response if enabled
      if (autoReadRef.current && accumulatedResponse.trim().length > 0) {
        // We fire and wait for it
        await speakText(assistantMsgId, accumulatedResponse);
      } else {
         // Resume mic immediately
         resumeMic();
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    doSend(text);
  };

  if (isLoading) {
    return (
      <div className={styles.container} style={{ justifyContent: "center", alignItems: "center" }}>
         <p className="text-muted">Loading thread history...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.messageList}>
        {messages.map((m, i) => (
          <div key={m.id || `msg-${i}`} className={`${styles.messageWrapper} ${m.role === 'user' ? styles.userWrapper : styles.aiWrapper}`}>
            <div className={`${styles.message} ${m.role === 'user' ? styles.userMessage : styles.aiMessage}`}>
              {m.role === 'assistant' ? (
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {preprocessLaTeX(m.content)}
                  </ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
            {m.role === 'assistant' && (
               <button 
                  onClick={() => speakText(m.id, m.content)} 
                  className={styles.ttsButton}
                  title={activeSpeechMsgId === m.id ? "Stop reading" : "Read aloud"}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9em', marginTop: '4px' }}
                >
                  {activeSpeechMsgId === m.id ? "⏹️" : "🔊"}
               </button>
            )}
          </div>
        ))}
        {isGenerating && (
          <div className={`${styles.messageWrapper} ${styles.aiWrapper}`}>
            <div className={`${styles.message} ${styles.aiMessage} ${styles.loading}`}>
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '10px 16px 0', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
         <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', color: autoReadEnabled ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
           <input type="checkbox" checked={autoReadEnabled} onChange={() => setAutoReadEnabled(!autoReadEnabled)} style={{ cursor: 'pointer' }} />
           🔊 Auto-Speak
         </label>
         <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', color: isListening ? 'inherit' : 'var(--text-muted)', fontWeight: isListening ? 600 : 400 }}>
           <input type="checkbox" checked={isListening} onChange={toggleMic} style={{ cursor: 'pointer', accentColor: 'var(--status-error)' }} disabled={isGenerating} />
           {isListening ? <span style={{ color: "var(--status-error)" }}>🔴 Voice Active</span> : "🎤 Voice Off"}
         </label>
         {/* Speed slider */}
         <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
           <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-geist-mono)' }}>Speed</span>
           <input
             type="range"
             min={0.5}
             max={3}
             step={0.25}
             value={speechSpeed}
             onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
             style={{ width: '80px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
             title={`Playback speed: ${speechSpeed}×`}
           />
           <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.78rem', minWidth: '30px', color: 'var(--accent-primary)' }}>{speechSpeed}×</span>
         </label>
      </div>

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Ask your Supervisor… (Shift+Enter for new line)"
          className={styles.input}
          disabled={isGenerating}
          rows={1}
        />
        <button type="submit" className="btn btn-primary" disabled={isGenerating || !input.trim()} style={{ alignSelf: 'flex-end' }}>
          {isGenerating ? "..." : "Send"}
        </button>
      </form>
      {errorMsg && <div style={{color: "red", fontSize: "0.8em", marginTop: "5px"}}>{errorMsg}</div>}
    </div>
  );
}

export function SupervisorPanel({ resourceId, moduleName, explicitSessionId, hasPastPaper, onTabSwitch }: SupervisorPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const { selectionData, clearSelection } = useTextSelection(containerRef);
  const [modalSelection, setModalSelection] = useState<any | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        if (selectionData) {
          e.preventDefault();
          setModalSelection(selectionData);
          clearSelection();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectionData, clearSelection]);

  const fetchSessions = async () => {
    try {
      const getRes = await fetch(`/api/supervisor/session?module=${encodeURIComponent(moduleName)}`);
      if (getRes.ok) {
        const { sessions: fetchedSessions } = await getRes.json();
        setSessions(fetchedSessions || []);
        return fetchedSessions;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  };

  const createNewThread = async () => {
    try {
      setIsInitializing(true);
      const postRes = await fetch("/api/supervisor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleName }),
      });

      if (postRes.ok) {
        const { session } = await postRes.json();
        if (session.openai_thread_id) {
           setSessions(prev => [session, ...prev]);
           setThreadId(session.openai_thread_id);
        }
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to start new thread.");
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    async function init() {
      setIsInitializing(true);
      const fetchedSessions = await fetchSessions();
      
      let targetId = null;
      if (explicitSessionId) {
         const found = fetchedSessions.find((s: any) => s.id === explicitSessionId);
         if (found) targetId = found.openai_thread_id;
      } 
      
      if (!targetId && fetchedSessions.length > 0) {
         targetId = fetchedSessions[0].openai_thread_id;
      }

      if (targetId) {
         setThreadId(targetId);
         setIsInitializing(false);
      } else {
         // No sessions exist, create new
         await createNewThread();
      }
    }
    init();
  }, [moduleName, explicitSessionId]);

  const handleThreadChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "NEW") {
       await createNewThread();
    } else {
       setThreadId(val);
    }
  };

  if (isInitializing && !threadId) {
    return (
      <div className={styles.container} style={{ justifyContent: "center", alignItems: "center" }}>
        <p className="text-muted">Instantiating Supervisor Session...</p>
      </div>
    );
  }

  if (!threadId) {
    return (
      <div className={styles.container} style={{ justifyContent: "center", alignItems: "center" }}>
        <p className="text-muted text-error" style={{ color: "red" }}>Failed to connect to Supervisor</p>
        <p style={{ color: "red", fontSize: "0.85em", marginTop: "1rem" }}>Have you uploaded notes to initialize the AI yet?</p>
        {errorMsg && <p style={{ color: "red", fontSize: "0.85em", marginTop: "1rem" }}>{errorMsg}</p>}
      </div>
    );
  }

  return (
     <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
       {modalSelection && (
         <FlashcardGeneratorModal
           selectionData={modalSelection}
           resourceId={resourceId!}
           moduleName={moduleName}
           onClose={() => setModalSelection(null)}
           onSuccess={() => setModalSelection(null)}
         />
       )}
       <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', alignItems: 'center', paddingRight: '16px' }}>
          <div style={{ display: 'flex', flexGrow: 1 }}>
            {hasPastPaper && (
              <button 
                style={{ flex: 'none', padding: 'var(--space-md) var(--space-lg)', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                onClick={() => onTabSwitch("past_paper")}
              >
                Answers
              </button>
            )}
            <button 
              style={{ flex: 'none', padding: 'var(--space-md) var(--space-lg)', background: 'var(--bg-primary)', border: 'none', borderBottom: '2px solid var(--accent-primary)', color: 'var(--accent-primary)', fontFamily: 'var(--font-geist-mono)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
            >
              AI Supervisor
            </button>
          </div>
          
          <select 
              value={threadId} 
              onChange={handleThreadChange}
              style={{ 
                 padding: '4px 8px', 
                 borderRadius: '6px', 
                 background: 'var(--bg-primary)', 
                 color: 'var(--text)', 
                 border: '1px solid rgba(255,255,255,0.1)',
                 fontSize: '0.85em',
                 cursor: 'pointer',
                 outline: 'none',
                 flexShrink: 0
              }}
           >
              {sessions.map((s, idx) => (
                 <option key={s.openai_thread_id} value={s.openai_thread_id}>
                   Session from {new Date(s.created_at).toLocaleDateString()}
                 </option>
              ))}
              <option value="NEW">+ Start New Thread</option>
           </select>
       </div>
       
       <div style={{ flexGrow: 1, overflow: 'hidden', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <SupervisorChat key={threadId} moduleName={moduleName} threadId={threadId} />
       </div>
     </div>
  );
}
