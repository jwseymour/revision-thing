"use client";

import styles from "./SupervisorPanel.module.css";
import { useEffect, useRef, useState, FormEvent, ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";

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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      window.speechSynthesis?.cancel(); // stop TTS on unmount/thread switch
    };
  }, [threadId, moduleName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value);

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition isn't supported in your browser.");
      return;
    }

    if (isListening) {
       // Cannot directly stop standard without reference, rely on UI. But we handle simple on/off.
       return; 
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev + " " + transcript).trim());
    };
    recognition.onerror = (e: any) => console.error("Speech reco error:", e);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const speakText = (msgId: string, text: string) => {
    if (!window.speechSynthesis) {
        alert("Text-to-speech isn't supported in your browser.");
        return;
    }
    
    window.speechSynthesis.cancel();
    if (activeSpeechMsgId === msgId) {
       setActiveSpeechMsgId(null);
       return;
    }
    
    // Strip markdown formatting for better TTS
    let cleanText = text.replace(/[#*`_]/g, '');
    cleanText = cleanText.replace(/\$\$.*?\$\$/g, ' math equation '); // crude math stripping
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setActiveSpeechMsgId(null);
    setActiveSpeechMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    window.speechSynthesis?.cancel();
    setActiveSpeechMsgId(null);

    const userMessage = input.trim();
    setInput("");
    setErrorMsg(null);
    setIsGenerating(true);

    const userMsgObj: Message = { id: crypto.randomUUID(), role: "user", content: userMessage };
    setMessages(prev => [...prev, userMsgObj]);

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
      
      const assistantMsgId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

      let accumulatedResponse = "";

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
    }
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
              {m.content}
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
        <button type="button" onClick={toggleMic} className="btn btn-secondary" disabled={isGenerating} title="Speech to Text">
          {isListening ? "🔴" : "🎤"}
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
       
       <div style={{ flexGrow: 1, overflow: 'hidden', padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column' }}>
          <SupervisorChat key={threadId} moduleName={moduleName} threadId={threadId} />
       </div>
     </div>
  );
}
