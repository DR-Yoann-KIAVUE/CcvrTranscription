// Convertit le HTML de l'éditeur (contentEditable) en une liste de blocs
// simples, réutilisée pour l'export DOCX et PDF.

export interface Run {
  text: string;
  bold: boolean;
}

export type BlockType = "h1" | "h2" | "p" | "li";

export interface Block {
  type: BlockType;
  runs: Run[];
}

function collectRuns(node: Node, bold: boolean): Run[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text ? [{ text, bold }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const style = el.getAttribute("style") ?? "";
  const isBold =
    bold ||
    tag === "b" ||
    tag === "strong" ||
    /font-weight:\s*(bold|[6-9]00)/i.test(style);

  const runs: Run[] = [];
  el.childNodes.forEach((child) => runs.push(...collectRuns(child, isBold)));
  return runs;
}

function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.bold === r.bold) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

export function parseEditorHtml(html: string): Block[] {
  const doc = new DOMParser().parseFromString(
    `<div id="root">${html}</div>`,
    "text/html"
  );
  const root = doc.getElementById("root");
  if (!root) return [];

  const blocks: Block[] = [];
  const pushBlock = (type: BlockType, node: Node) => {
    const runs = mergeRuns(collectRuns(node, false)).filter(
      (r) => r.text.trim() !== "" || r.text.includes(" ")
    );
    if (runs.length === 0 && type !== "p") return;
    blocks.push({ type, runs });
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim()) blocks.push({ type: "p", runs: [{ text, bold: false }] });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    switch (el.tagName.toLowerCase()) {
      case "h1":
        pushBlock("h1", el);
        break;
      case "h2":
      case "h3":
        pushBlock("h2", el);
        break;
      case "ul":
      case "ol":
        el.querySelectorAll(":scope > li").forEach((li) => pushBlock("li", li));
        break;
      case "br":
        break;
      default:
        pushBlock("p", el);
    }
  });

  // Garantit au moins un bloc.
  if (blocks.length === 0) blocks.push({ type: "p", runs: [] });
  return blocks;
}

/** Version texte brut (pour titres de fichiers, aperçus). */
export function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "li" ? "• " : "") + b.runs.map((r) => r.text).join(""))
    .join("\n");
}
