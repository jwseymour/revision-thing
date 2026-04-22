"use client";

import styles from "./SupervisorPanel.module.css";
import { useEffect, useRef, useState, FormEvent, ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isListeningRef = useRef(false);
  const isMicSuspendedRef = useRef(false);
  const autoReadRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  // Sync ref for callback closures
  useEffect(() => {
    autoReadRef.current = autoReadEnabled;
  }, [autoReadEnabled]);

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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value);

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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
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

      <form onSubmit={handleSubmit} className={styles.inputArea} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask your Supervisor..."
          className={styles.input}
          disabled={isGenerating}
          style={{ flexGrow: 1 }}
        />
        <button 
          type="button" 
          onClick={() => setAutoReadEnabled(!autoReadEnabled)} 
          className={`btn btn-sm ${autoReadEnabled ? "btn-primary" : "btn-secondary"}`} 
          title="Auto-Read AI Replies"
          style={{ padding: '0 8px', fontSize: '1.2rem', background: autoReadEnabled ? 'var(--accent-primary-muted)' : 'var(--bg-tertiary)' }}
        >
          {autoReadEnabled ? "🔊" : "🔈"}
        </button>
        <button 
          type="button" 
          onClick={toggleMic} 
          className="btn btn-secondary" 
          disabled={isGenerating} 
          title="Voice Conversation Mode (Always On)"
          style={{ position: 'relative' }}
        >
          {isListening ? (
             <>
               <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: 'red', borderRadius: '50%', boxShadow: '0 0 4px red' }} className={styles.pulsingBlob}></span>
               🎙️
             </>
          ) : "🎤"}
        </button>
        <button type="submit" className="btn btn-primary" disabled={isGenerating || !input.trim()}>
          {isGenerating ? "..." : "Send"}
        </button>
      </form>
      {errorMsg && <div style={{color: "red", fontSize: "0.8em", marginTop: "5px"}}>{errorMsg}</div>}
    </div>
  );
}

export function SupervisorPanel({ moduleName, explicitSessionId, hasPastPaper, onTabSwitch }: SupervisorPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
     <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
