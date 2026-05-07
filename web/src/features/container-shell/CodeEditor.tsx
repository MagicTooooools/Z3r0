import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { xml } from "@codemirror/lang-xml";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { php } from "@codemirror/lang-php";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { useEffect, useMemo, useRef } from "react";

type Props = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  filename?: string;
};

function resolveLanguage(filename: string) {
  if (!filename) return null;
  const base = filename.split("/").pop() || filename;
  const e = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1).toLowerCase() : "";
  const key = base === "Dockerfile" ? "Dockerfile" : base === "Makefile" ? "Makefile" : e;
  if (!key) return null;

  switch (key) {
    case "js": case "jsx": case "mjs": case "cjs": return javascript();
    case "ts": return javascript({ typescript: true });
    case "tsx": return javascript({ typescript: true, jsx: true });
    case "py": case "pyx": return python();
    case "json": return json();
    case "html": case "htm": return html();
    case "css": case "scss": case "less": return css();
    case "xml": case "svg": return xml();
    case "sql": return sql();
    case "md": case "markdown": return markdown();
    case "yaml": case "yml": return [StreamLanguage.define(yaml)];
    case "rs": return rust();
    case "go": return go();
    case "java": return java();
    case "c": case "cpp": case "cc": case "cxx": case "h": case "hpp": case "hh": case "hxx": return cpp();
    case "php": return php();
    case "sh": case "bash": case "zsh": return [StreamLanguage.define(shell)];
    case "Dockerfile": return [StreamLanguage.define(dockerFile)];
    default: return null;
  }
}

export function CodeEditor({ value, onChange, readOnly = false, filename }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const updateListener = useMemo(
    () => EditorView.updateListener.of((update) => {
      if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
    }),
    [],
  );

  useEffect(() => {
    if (!hostRef.current) return;

    const lang = resolveLanguage(filename || "");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exts: any[] = [
      basicSetup,
      oneDark,
      updateListener,
      EditorView.lineWrapping,
      ...(lang ? (Array.isArray(lang) ? lang : [lang]) : []),
    ];
    if (readOnly) {
      exts.push(EditorState.readOnly.of(true));
      exts.push(EditorView.editable.of(false));
    }

    const view = new EditorView({
      doc: value,
      extensions: exts,
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => view.destroy();
  }, [readOnly, filename]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.hasFocus) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className="cm-host" />;
}
