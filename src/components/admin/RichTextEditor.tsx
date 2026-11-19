"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import DOMPurify from "dompurify";

function editorContent(value: string) {
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return DOMPurify.sanitize(value);
  const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.split(/\n\s*\n/).map(paragraph => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("");
}

export function RichTextEditor({ value, onChange, label, id, disabled = false, required = false }: {
  value: string; onChange: (value: string) => void; label: string; id?: string; disabled?: boolean; required?: boolean;
}) {
  const lastValue = useRef(value);
  const [showLink, setShowLink] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({ link: { openOnClick: false, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } }), Image.configure({ allowBase64: false })],
    content: typeof window === "undefined" ? "" : editorContent(value),
    editable: !disabled,
    editorProps: { attributes: { ...(id ? { id } : {}), class: "blog-prose min-h-40 p-3 text-sm outline-none", role: "textbox", "aria-label": label, "aria-multiline": "true", "aria-required": String(required) } },
    onUpdate: ({ editor }) => {
      const next = editor.isEmpty ? "" : editor.getHTML();
      lastValue.current = next;
      onChange(next);
    },
  });
  useEffect(() => {
    if (editor && value !== lastValue.current) {
      editor.commands.setContent(editorContent(value), { emitUpdate: false });
      lastValue.current = value;
    }
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  if (!editor) return <div role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">Loading editor…</div>;
  const commands = [
    { label: "Bold", active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Underline", active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Heading", active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Bullet list", active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Undo", run: () => editor.chain().focus().undo().run() },
    { label: "Redo", run: () => editor.chain().focus().redo().run() },
  ];
  return <div className="rounded-lg border bg-background font-normal">
    <div role="toolbar" aria-label={`${label} formatting`} className="flex flex-wrap gap-1 border-b bg-muted/20 p-2">
      {commands.map(command => <button key={command.label} type="button" disabled={disabled} aria-pressed={command.active} onMouseDown={event => event.preventDefault()} onClick={command.run} className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${command.active ? "bg-primary text-primary-foreground" : "bg-background"}`}>{command.label}</button>)}
      <button type="button" disabled={disabled} onClick={() => { setLink(editor.getAttributes("link").href || ""); setError(""); setShowLink(!showLink); }} className="rounded border px-2 py-1 text-xs">Link</button>
      {editor.isActive("link") && <button type="button" disabled={disabled} onClick={() => editor.chain().focus().unsetLink().run()} className="rounded border px-2 py-1 text-xs">Remove link</button>}
    </div>
    {showLink && <div className="space-y-2 border-b p-2">
      <label className="block space-y-1 text-xs"><span>Link address</span><input type="text" disabled={disabled} value={link} onChange={event => setLink(event.target.value)} placeholder="https://example.com" className="w-full rounded border bg-background p-2" /></label>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <button type="button" disabled={disabled} className="rounded border px-2 py-1 text-xs" onClick={() => {
        const href = link.trim();
        try { if (!["https:", "http:", "mailto:", "tel:"].includes(new URL(href).protocol)) throw Error(); }
        catch { setError("Enter a valid website, email or telephone link."); return; }
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run(); setShowLink(false);
      }}>Apply link</button>
    </div>}
    <EditorContent editor={editor} />
    {required && <input aria-label={`${label} required content`} tabIndex={-1} className="sr-only" required disabled={disabled} value={editor.isEmpty ? "" : "filled"} onChange={() => {}} onInvalid={() => editor.commands.focus()} />}
  </div>;
}
