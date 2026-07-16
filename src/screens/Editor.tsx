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

  useImperativeHandle(ref, () => ({
    insertHtml: (html: string) => {
      const el = elRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        if (
          savedRange.current &&
          el.contains(savedRange.current.commonAncestorContainer)
        ) {
          sel.addRange(savedRange.current);
        } else {
          const r = document.createRange();
          r.selectNodeContents(el);
          r.collapse(false); // fin du contenu
          sel.addRange(r);
        }
      }
      document.execCommand("insertHTML", false, html);
      saveSelection();
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
