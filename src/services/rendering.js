function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHtmlTag(text) {
  return /^<\/?[A-Za-z][^>]*>$/.test(text.trim());
}

function isHtmlBlockStart(line) {
  return /^<\/?[A-Za-z][^>]*>$/.test(line.trim()) && !line.trim().startsWith("</");
}

function renderInline(markdown) {
  const parts = String(markdown).split(/(<[^>]+>)/g);
  let html = parts.map((part) => (isHtmlTag(part) ? part : escapeHtml(part))).join("");

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return html;
}

function renderParagraph(lines) {
  const content = lines.join(" ").trim();

  if (!content) {
    return "";
  }

  return `<p>${renderInline(content)}</p>`;
}

function renderHeading(line) {
  const match = line.match(/^(#{1,6})\s+(.*)$/);

  if (!match) {
    return null;
  }

  const level = match[1].length;
  const content = match[2].trim();

  return `<h${level}>${renderInline(content)}</h${level}>`;
}

function renderList(lines) {
  const isOrdered = /^\d+\.\s+/.test(lines[0]);
  const tagName = isOrdered ? "ol" : "ul";
  const items = lines.map((line) => {
    const content = line.replace(/^([-*]|\d+\.)\s+/, "");
    return `<li>${renderInline(content)}</li>`;
  });

  return `<${tagName}>${items.join("")}</${tagName}>`;
}

function renderCodeBlock(lines) {
  const content = lines.join("\n");
  return `<pre><code>${escapeHtml(content)}</code></pre>`;
}

function renderHtmlBlock(lines) {
  return lines.join("\n");
}

function renderMarkdown(markdown) {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length && lines[index].startsWith("```")) {
        index += 1;
      }

      blocks.push(renderCodeBlock(codeLines));
      continue;
    }

    if (isHtmlBlockStart(line)) {
      const htmlLines = [line];
      index += 1;

      while (index < lines.length) {
        const currentLine = lines[index];
        htmlLines.push(currentLine);
        index += 1;

        if (!currentLine.trim()) {
          break;
        }

        if (/^<\/[A-Za-z][^>]*>$/.test(currentLine.trim())) {
          break;
        }
      }

      blocks.push(renderHtmlBlock(htmlLines));
      continue;
    }

    const heading = renderHeading(line);

    if (heading) {
      blocks.push(heading);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const listLines = [];
      const ordered = /^\d+\.\s+/.test(line);

      while (index < lines.length) {
        const currentLine = lines[index];
        const matchesList = ordered
          ? /^\d+\.\s+/.test(currentLine)
          : /^[-*]\s+/.test(currentLine);

        if (!matchesList) {
          break;
        }

        listLines.push(currentLine);
        index += 1;
      }

      blocks.push(renderList(listLines));
      continue;
    }

    const paragraphLines = [];

    while (index < lines.length) {
      const currentLine = lines[index];

      if (
        !currentLine.trim() ||
        currentLine.startsWith("```") ||
        /^(#{1,6})\s+/.test(currentLine) ||
        /^[-*]\s+/.test(currentLine) ||
        /^\d+\.\s+/.test(currentLine)
      ) {
        break;
      }

      paragraphLines.push(currentLine.trim());
      index += 1;
    }

    blocks.push(renderParagraph(paragraphLines));
  }

  return blocks.filter(Boolean).join("\n");
}

module.exports = {
  escapeHtml,
  isHtmlBlockStart,
  isHtmlTag,
  renderCodeBlock,
  renderHeading,
  renderHtmlBlock,
  renderInline,
  renderList,
  renderMarkdown,
  renderParagraph
};
