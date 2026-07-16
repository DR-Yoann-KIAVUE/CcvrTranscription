import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

interface Props {
  initialHtml: string;
  onChange: (html: string) => void;
}

export interface EditorHandle {
  /** Insère du HTML à la position du curseur (ou en fin si aucun curseur). */
  insertHtml: (html: string) => void;
}

/** Éditeur riche minimal basé sur contentEditable + execCommand. */
const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { initialHtml, onChange },
  ref
) {
  const elRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (elRef.current) elRef.current.innerHTML = initialHtml || "";
    // Le parent remonte l'éditeur (via key) quand il remplace tout le contenu ;
    // on ne resynchronise pas à chaque frappe pour préserver le curseur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    if (elRef.current) onChange(elRef.current.innerHTML);
  };

  // Mémorise la position du curseur tant qu'il est dans l'éditeur, afin de
  // pouvoir y insérer la transcription même après avoir cliqué ailleurs.
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

      // Construit les blocs à insérer (paragraphes issus du nettoyage).
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const newNodes = Array.from(tmp.childNodes);
      if (newNodes.length === 0) return;

      // Trouve le bloc cible : l'enfant direct de l'éditeur contenant le curseur.
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
        // Insère les nouveaux paragraphes juste après la section/ligne courante.
        let refNode: ChildNode = anchor;
        for (const node of newNodes) {
          (refNode as ChildNode).after(node);
          refNode = node as ChildNode;
        }
        last = refNode;
        // Si on a cliqué sur une ligne vide (pas un titre), on la retire.
        if (isEmpty && !isHeading) anchor.remove();
      } else {
        // Aucun curseur mémorisé : ajout propre en fin de document.
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

  return (
    <div>
      <div className="editor-toolbar">
        <button title="Gras" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")}>
          <b>G</b>
        </button>
        <button
          title="Titre"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => cmd("formatBlock", "H1")}
        >
          T1
        </button>
        <button
          title="Sous-titre"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => cmd("formatBlock", "H2")}
        >
          T2
        </button>
        <button
          title="Paragraphe normal"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => cmd("formatBlock", "P")}
        >
          ¶
        </button>
        <button
          title="Liste à puces"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => cmd("insertUnorderedList")}
        >
          Liste
        </button>
      </div>
      <div
        ref={elRef}
        className="editor"
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
