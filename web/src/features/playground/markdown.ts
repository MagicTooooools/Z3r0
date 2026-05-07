export function normalizeMarkdownForRender(text: string, streaming: boolean) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const spaced = normalizeMarkdownBlockBreaks(normalized);
  if (!streaming) return spaced;

  const openFence = getOpenMarkdownFence(spaced);
  if (!openFence) return spaced;
  return `${spaced.endsWith("\n") ? spaced : `${spaced}\n`}${openFence}`;
}

function normalizeMarkdownBlockBreaks(markdown: string) {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let fence = "";

  for (const line of lines) {
    const currentFence = markdownFenceMarker(line);
    if (fence) {
      out.push(line);
      if (currentFence && currentFence[0] === fence[0] && currentFence.length >= fence.length) {
        fence = "";
      }
      continue;
    }

    const blockType = markdownBlockType(line);
    if (blockType && shouldInsertMarkdownBlockBreak(out, blockType)) {
      out.push("");
    }
    out.push(line);
    if (currentFence) fence = currentFence;
  }

  return out.join("\n");
}

function shouldInsertMarkdownBlockBreak(lines: string[], nextType: string) {
  const previous = lines[lines.length - 1] ?? "";
  if (!previous.trim()) return false;

  const previousType = markdownBlockType(previous);
  return previousType !== nextType || !["list", "quote", "table"].includes(nextType);
}

function markdownBlockType(line: string) {
  if (!line.trim() || /^\s/.test(line)) return "";
  if (markdownFenceMarker(line)) return "fence";
  if (/^#{1,6}\s+\S/.test(line)) return "heading";
  if (/^(?:[-*+]\s+|\d{1,9}[.)]\s+)/.test(line)) return "list";
  if (/^>\s?/.test(line)) return "quote";
  if (/^\|.+\|\s*$/.test(line)) return "table";
  if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return "rule";
  return "";
}

function getOpenMarkdownFence(markdown: string) {
  let open = "";
  for (const line of markdown.split("\n")) {
    const marker = markdownFenceMarker(line);
    if (!marker) continue;
    if (!open) {
      open = marker;
      continue;
    }
    if (marker[0] === open[0] && marker.length >= open.length) {
      open = "";
    }
  }
  return open;
}

function markdownFenceMarker(line: string) {
  return line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1] ?? "";
}
