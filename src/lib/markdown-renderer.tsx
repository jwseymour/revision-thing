"use client";

import { useMemo } from "react";

/**
 * Lightweight markdown renderer with KaTeX math support.
 * Handles: paragraphs, headings, bold, italic, inline code,
 * fenced code blocks, lists, and LaTeX via $ / $$ delimiters.
 * 
 * NOTE: KaTeX rendering is done via CSS + HTML class names.
 * The actual KaTeX CSS is loaded in the content page.
 */

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(md: string): string {
  if (!md) return "";

  let html = md;

  // Step 1: Extract and protect fenced code blocks
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = escapeHtml(code.trimEnd());
    const langClass = lang ? ` data-language="${escapeHtml(lang)}"` : "";
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre class="code-block"${langClass}><code>${escaped}</code></pre>`);
    return placeholder;
  });

  // Step 2: Extract and protect display math ($$...$$)
  const mathBlocks: string[] = [];
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    const placeholder = `__MATH_BLOCK_${mathBlocks.length}__`;
    mathBlocks.push(`<div class="math-display" data-math="${escapeHtml(math.trim())}">${escapeHtml(math.trim())}</div>`);
    return placeholder;
  });

  // Step 3: Extract and protect inline math ($...$)
  const inlineMaths: string[] = [];
  html = html.replace(/\$([^\$\n]+?)\$/g, (_match, math) => {
    const placeholder = `__INLINE_MATH_${inlineMaths.length}__`;
    inlineMaths.push(`<span class="math-inline" data-math="${escapeHtml(math.trim())}">${escapeHtml(math.trim())}</span>`);
    return placeholder;
  });

  // Step 4: Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Step 5: Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Step 6: Headings
  html = html.replace(/^#### (.+)$/gm, '<h4 class="md-heading">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-heading">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-heading">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-heading">$1</h1>');

  // Step 7: Lists (simple implementation)
  html = html.replace(/^[-*] (.+)$/gm, '<li class="md-list-item">$1</li>');
  html = html.replace(/((?:<li class="md-list-item">.*<\/li>\n?)+)/g, '<ul class="md-list">$1</ul>');

  // Numbered lists
  html = html.replace(/^\d+\.\s(.+)$/gm, '<li class="md-list-item">$1</li>');

  // Step 8: Paragraphs — wrap remaining text blocks
  const lines = html.split("\n\n");
  html = lines
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return trimmed; // Already HTML
      if (trimmed.startsWith("__")) return trimmed; // Placeholder
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  // Step 9: Restore placeholders
  inlineMaths.forEach((math, i) => {
    html = html.replace(`__INLINE_MATH_${i}__`, math);
  });
  mathBlocks.forEach((math, i) => {
    html = html.replace(`__MATH_BLOCK_${i}__`, math);
  });
  codeBlocks.forEach((code, i) => {
    html = html.replace(`__CODE_BLOCK_${i}__`, code);
  });

  return html;
}
