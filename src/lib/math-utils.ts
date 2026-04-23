/**
 * Normalizes OpenAI-style LaTeX delimiters into standard Markdown math delimiters.
 * Converts \( ... \) to $ ... $
 * Converts \[ ... \] to $$ ... $$
 */
export function preprocessLaTeX(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\\\[/g, '$$$$')  // JavaScript replace needs $$$$ to output literal $$
    .replace(/\\\]/g, '$$$$');
}
