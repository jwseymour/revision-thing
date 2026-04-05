"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import styles from "./supervisor.module.css";
import { MarkdownContent } from "@/lib/markdown-renderer";

interface Topic {
  module: string;
  topic: string;
}

export default function SupervisorClient({ availableTopics }: { availableTopics: Topic[] }) {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/supervisor",
      body: {
        module: selectedTopic?.module,
        topic: selectedTopic?.topic,
        sessionId,
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendMessage({ role: "user", content: input, text: input } as any);
    setInput("");
  };

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startSession = async (topic: Topic) => {
    setSelectedTopic(topic);
    setIsInitializing(true);

    try {
      // Create session first
      const res = await fetch("/api/supervisor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: topic.module, topic: topic.topic }),
      });

      if (res.ok) {
        const { sessionId } = await res.json();
        setSessionId(sessionId);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const endSession = () => {
    setSelectedTopic(null);
    setSessionId(null);
  };

  if (!selectedTopic) {
    return (
      <div className={styles.setupContainer}>
        <div className={styles.header}>
          <h1>AI Supervisor</h1>
          <p className="text-muted">Engage in Socratic dialogue to test true understanding.</p>
        </div>

        {availableTopics.length === 0 ? (
          <div className="card text-center" style={{ padding: "var(--space-3xl)" }}>
            <h3>No topics available</h3>
            <p className="text-muted">You need to upload PDFs and generate content first.</p>
          </div>
        ) : (
          <div className={styles.topicGrid}>
            {availableTopics.map((t, idx) => (
              <div
                key={idx}
                className={`card card-hover ${styles.topicCard}`}
                onClick={() => startSession(t)}
              >
                <h3>{t.topic}</h3>
                <span className={styles.moduleName}>{t.module}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.chatContainer}>
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatInfo}>
          <h2>{selectedTopic.topic}</h2>
          <span className="text-muted text-sm">{selectedTopic.module}</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={endSession}>
          End Session
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messageArea}>
        {messages.length === 0 && !isLoading && !isInitializing && (
          <div className={styles.emptyChat}>
            <span>🎓</span>
            <h3>Supervisor is ready</h3>
            <p className="text-muted">Say hello to begin the supervision on {selectedTopic.topic}.</p>
          </div>
        )}

        {isInitializing && (
          <div className={styles.emptyChat}>
            <span className="spinner"></span>
            <p>Preparing notes context...</p>
          </div>
        )}

        {messages.map((m) => {
          const msg = m as unknown as { id: string; role: string; content?: string; parts?: { text: string }[] };
          const textContent = msg.content || (msg.parts ? msg.parts.map((p) => p.text).join("") : "");

          return (
            <div
              key={msg.id}
              className={`${styles.messageWrapper} ${
                msg.role === "user" ? styles.messageUser : styles.messageAssistant
              }`}
            >
              <div className={styles.messageBubble}>
                {msg.role === "assistant" ? (
                  <MarkdownContent content={textContent} />
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{textContent}</div>
                )}
              </div>
              <div className={styles.messageRole}>
                {msg.role === "user" ? "You" : "Supervisor"}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className={`${styles.messageWrapper} ${styles.messageAssistant}`}>
            <div className={`${styles.messageBubble} ${styles.typing}`}>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Base */}
      <div className={styles.inputArea}>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <input
            className={styles.chatInput}
            value={input}
            onChange={handleInputChange}
            placeholder="Type your answer, ask for a hint, or say hello..."
            disabled={isLoading || isInitializing}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || isInitializing || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
