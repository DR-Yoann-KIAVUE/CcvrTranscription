import { useEffect, useRef } from "react";

interface Props {
  initialHtml: string;
  onChange: (html: string) => void;
}

/** Éditeur riche minimal basé sur contentEditable + execCommand. */
export default function Editor({ initialHtml, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || "";
    // Remonté par le parent (key) au changement de CR : on ne resynchronise
    // pas à chaque frappe pour préserver la position du curseur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const cmd = (command: string, value?: string) => {
    ref.current?.focus();
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
          • Liste
        </button>
      </div>
      <div
        ref={ref}
        className="editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Le compte-rendu apparaîtra ici après la transcription. Vous pouvez le relire et le corriger."
        onInput={emit}
      />
    </div>
  );
}
