import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Heading1, Heading2, List, Pilcrow } from "lucide-react";

interface Props {
  initialHtml: string;
  onChange: (html: string) => void;
}

export interface EditorHandle {
  insertHtml: (html: string) => void;
}

const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { initialHtml, onChange },
  ref
) {
  const elRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (elRef.current) elRef.current.innerHTML = initialHtml || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    if (elRef.current) onChange(elRef.current.innerHTML);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && elRef.current) {
      const r = sel.getRangeAt(0);
      if (elRef.current.contains(r.commonAncestorContainer)) {
        savedRange.current = r.cloneRange();
      }
    }
  };

  const placeCaretAfter = (node: Node) => {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.selectNodeContents(node);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange.current = r.cloneRange();
  };

  useImperativeHandle(ref, () => ({
    insertHtml: (html: string) => {
      const el = elRef.current;
      if (!el) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const newNodes = Array.from(tmp.childNodes);
      if (newNodes.length === 0) return;

      let anchor: ChildNode | null = null;
      const r = savedRange.current;
      if (r && el.contains(r.commonAncestorContainer)) {
        let n: Node | null = r.startContainer;
        while (n && n.parentNode !== el) n = n.parentNode;
        if (n && n.parentNode === el) anchor = n as ChildNode;
      }

      let last: Node;
      if (anchor) {
        const isHeading = /^H[1-3]$/.test((anchor as HTMLElement).tagName ?? "");
        const isEmpty = (anchor.textContent ?? "").trim() === "";
        let refNode: ChildNode = anchor;
        for (const node of newNodes) {
          (refNode as ChildNode).after(node);
          refNode = node as ChildNode;
        }
        last = refNode;
        if (isEmpty && !isHeading) anchor.remove();
      } else {
        for (const node of newNodes) el.appendChild(node);
        last = el.lastChild as Node;
      }
      placeCaretAfter(last);
      emit();
    },
  }));

  const cmd = (command: string, value?: string) => {
    elRef.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  const md = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div>
      <div className="mb-2 flex gap-1">
        <Button variant="outline" size="icon" className="size-8" title="Gras" onMouseDown={md} onClick={() => cmd("bold")}>
          <Bold className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="size-8" title="Titre" onMouseDown={md} onClick={() => cmd("formatBlock", "H1")}>
          <Heading1 className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="size-8" title="Sous-titre" onMouseDown={md} onClick={() => cmd("formatBlock", "H2")}>
          <Heading2 className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="size-8" title="Paragraphe" onMouseDown={md} onClick={() => cmd("formatBlock", "P")}>
          <Pilcrow className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="size-8" title="Liste à puces" onMouseDown={md} onClick={() => cmd("insertUnorderedList")}>
          <List className="size-4" />
        </Button>
      </div>
      <div
        ref={elRef}
        className="cr-content min-h-[420px] overflow-y-auto rounded-lg border bg-card px-6 py-5 shadow-xs outline-none focus:ring-2 focus:ring-ring/40"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Le compte-rendu apparaîtra ici après la transcription. Vous pouvez le relire et le corriger."
        onInput={emit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
      />
    </div>
  );
});

export default Editor;
