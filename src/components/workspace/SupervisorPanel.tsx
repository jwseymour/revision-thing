"use client";

import { useChat, Message } from "@ai-sdk/react";
import styles from "./SupervisorPanel.module.css";
import { useEffect, useRef, useState } from "react";

interface SupervisorPanelProps {
  resourceId?: string;
  moduleName: string;
  explicitSessionId?: string;
}

function SupervisorChat({ 
  resourceId, 
  moduleName, 
  sessionId, 
  initialMessages 
}: { 
  resourceId?: string;
  moduleName: string; 
  sessionId: string;
  initialMessages: Message[];
}) {
  const { messages, setMessages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/supervisor",
    body: { 
      module: moduleName,
      sessionId: sessionId,
      context: { resourceId }
    },
    initialMessages,
    onError: (err) => {
      console.error("useChat Error:", err);
    },
    onResponse: (res) => {
      console.log("useChat Response:", res.status, res.headers.get("content-type"));
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fallback: If the SDK silently drops initial messages on mount
  useEffect(() => {
    if (messages.length === 0 && initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={styles.container}>
      <div className={styles.messageList}>
        {messages.map((m, i) => (
          <div key={m.id || `msg-${i}`} className={`${styles.messageWrapper} ${m.role === 'user' ? styles.userWrapper : styles.aiWrapper}`}>
            <div className={`${styles.message} ${m.role === 'user' ? styles.userMessage : styles.aiMessage}`}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.messageWrapper} ${styles.aiWrapper}`}>
            <div className={`${styles.message} ${styles.aiMessage} ${styles.loading}`}>
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question..."
          className={styles.input}
          disabled={isLoading}
        />
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? "Wait..." : error ? "Error!" : "Send"}
        </button>
      </form>
      {error && <div style={{color: "red", fontSize: "0.8em", marginTop: "5px"}}>{error.message}</div>}
    </div>
  );
}

export function SupervisorPanel({ resourceId, moduleName, explicitSessionId }: SupervisorPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function initSession() {
      try {
        setIsInitializing(true);
        const getRes = await fetch(`/api/supervisor/session?module=${encodeURIComponent(moduleName)}`);
        if (getRes.ok) {
          const { sessions } = await getRes.json();
          let targetSession = null;
          
          if (explicitSessionId) {
            targetSession = sessions.find((s: any) => s.id === explicitSessionId);
          } else if (sessions && sessions.length > 0) {
            targetSession = sessions[0];
          }

          if (targetSession) {
            setSessionId(targetSession.id);
            const msgs = targetSession.messages || [];
            
            // Map over messages to ensure IDs exist because of legacy corrupt DB state!
            let validatedMsgs = msgs.map((m: any, i: number) => ({
              ...m,
              id: m.id || `legacy-id-${i}-${Math.random()}`
            }));

            if (validatedMsgs.length === 0) {
              setInitialMessages([{ id: crypto.randomUUID(), role: "assistant", content: `Hello! I am your AI Supervisor for **${moduleName}**. What would you like to discuss today?` }]);
            } else {
              setInitialMessages(validatedMsgs);
            }
            setIsInitializing(false);
            return;
          }
        }

        const postRes = await fetch("/api/supervisor/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module: moduleName }),
        });

        if (postRes.ok) {
          const { session } = await postRes.json();
          setSessionId(session.id);
          setInitialMessages([{ id: crypto.randomUUID(), role: "assistant", content: `Hello! I am your AI Supervisor for **${moduleName}**. What would you like to discuss today?` }]);
        } else {
          const bodyText = await postRes.text();
          setErrorMsg(`Session initialize rejected: ${postRes.status} ${bodyText}`);
        }
      } catch (e) {
        if (e instanceof Error) {
           setErrorMsg(`Network Error: ${e.message}`);
        } else {
           setErrorMsg(`Unknown Network Error`);
        }
      } finally {
        setIsInitializing(false);
      }
    }
    initSession();
  }, [moduleName, explicitSessionId]);

  if (isInitializing) {
    return (
      <div className={styles.container} style={{ justifyContent: "center", alignItems: "center" }}>
        <p className="text-muted">Instantiating Supervisor Session...</p>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className={styles.container} style={{ justifyContent: "center", alignItems: "center" }}>
        <p className="text-muted text-error" style={{ color: "red" }}>Failed to connect to Supervisor</p>
        {errorMsg && <p style={{ color: "red", fontSize: "0.85em", marginTop: "1rem" }}>{errorMsg}</p>}
      </div>
    );
  }

  return <SupervisorChat resourceId={resourceId} moduleName={moduleName} sessionId={sessionId} initialMessages={initialMessages} />;
}
