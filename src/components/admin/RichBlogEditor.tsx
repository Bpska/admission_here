"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { Bold, Italic, Underline, Highlighter, Link2, Unlink, ImagePlus, List, ListOrdered, Quote, Undo2, Redo2, Eraser, X } from "lucide-react";
import { blogBlocksForEditor } from "@/lib/blog-content";
import { useScrollLock } from "@/hooks/useScrollLock";

const BlogBlock = Node.create({
  name: "blogBlock", group: "block", atom: true,
  addAttributes() {
    return {
      kind: { default: "tldr", parseHTML: element => element.getAttribute("data-blog-block"), rendered: false },
      slug: { default: "", parseHTML: element => element.getAttribute("data-college-slug") || "", rendered: false },
    };
  },
  parseHTML() { return [{ tag: "div[data-blog-block]" }]; },
  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.kind === "college" ? `College card: ${node.attrs.slug}` : node.attrs.kind === "live" ? "Live updates block" : "Article summary block";
    return ["div", mergeAttributes(HTMLAttributes, { "data-blog-block": node.attrs.kind, "data-college-slug": node.attrs.slug }), label];
  },
});

function editorHtml(content: string) {
  const html = marked.parse(blogBlocksForEditor(content), { async: false, breaks: true });
  return DOMPurify.sanitize(html);
}
function validLink(value: string, image = false) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try { return (image ? ["https:", "http:"] : ["https:", "http:", "mailto:", "tel:"]).includes(new URL(value).protocol); }
  catch { return false; }
}

export function RichBlogEditor({ value, onChange, onBusyChange }: {
  value: string; onChange: (value: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  const lastValue = useRef(value);
  const selection = useRef({ from: 1, to: 1 });
  const [dialog, setDialog] = useState<"link" | "images" | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  useScrollLock(Boolean(dialog));
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, defaultProtocol: "https", HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } } }),
      Image.configure({ allowBase64: false }), Highlight, BlogBlock,
    ],
    content: typeof window === "undefined" ? "" : editorHtml(value),
    editorProps: { attributes: { class: "blog-prose min-h-[360px] p-4 focus:outline-none", role: "textbox", "aria-label": "Blog article", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => { const html = editor.getHTML(); lastValue.current = html; onChange(html); },
  });
  useEffect(() => {
    if (editor && value !== lastValue.current) { editor.commands.setContent(editorHtml(value), { emitUpdate: false }); lastValue.current = value; }
  }, [editor, value]);

  function openDialog(kind: "link" | "images") {
    if (!editor) return;
    selection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
    setError("");
    if (kind === "link") {
      setLinkUrl(editor.getAttributes("link").href || "");
      setLinkText(editor.state.doc.textBetween(selection.current.from, selection.current.to, " "));
    }
    setDialog(kind);
  }
  function insertImages(nodes: JSONContent[]) {
    if (!editor || nodes.length === 0) return;
    editor.chain().focus().setTextSelection({ from: Math.min(selection.current.from, editor.state.doc.content.size), to: Math.min(selection.current.to, editor.state.doc.content.size) }).insertContent(nodes.flatMap(node => [node, { type: "paragraph" }])).run();
    selection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
  }
  async function uploadPictures() {
    if (!files.length || uploading) return;
    if (files.length > 10 || files.some(file => file.size > 3 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))) {
      setError("Choose up to 10 JPEG, PNG, GIF or WebP pictures, each 3 MB or smaller."); return;
    }
    setUploading(true); onBusyChange(true); setError("");
    const nodes: JSONContent[] = [], failed: File[] = [];
    try {
      for (const file of files) {
        try {
          const form = new FormData(); form.append("file", file);
          const response = await fetch("/api/v1/cms/blog-images", { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Upload failed");
          nodes.push({ type: "image", attrs: { src: data.url, alt: imageAlt.trim() || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") } });
        } catch { failed.push(file); }
      }
      insertImages(nodes); setFiles(failed);
      if (failed.length) setError(`Unable to upload ${failed.length} picture(s). The other pictures were inserted. Try the remaining files again.`);
      else { setDialog(null); setImageAlt(""); }
    } finally { setUploading(false); onBusyChange(false); }
  }
  const buttonClass = (active = false) => `rounded-md border p-2 transition-colors disabled:opacity-40 ${active ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`;
  if (!editor) return <p role="status" className="p-4 text-sm text-muted-foreground">Loading editor…</p>;

  return <>
    <div role="toolbar" aria-label="Article formatting" className="flex flex-wrap items-center gap-1 border-b bg-muted/20 p-2">
      <select aria-label="Text style" value={[1, 2, 3].find(level => editor.isActive("heading", { level })) || "paragraph"} onChange={event => {
        if (event.target.value === "paragraph") editor.chain().focus().setParagraph().run();
        else editor.chain().focus().setHeading({ level: Number(event.target.value) as 1 | 2 | 3 }).run();
      }} className="rounded-md border bg-background p-2 text-xs"><option value="paragraph">Normal text</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
      {[
        { label: "Bold", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
        { label: "Underline", icon: Underline, active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
        { label: "Highlight", icon: Highlighter, active: editor.isActive("highlight"), run: () => editor.chain().focus().toggleHighlight().run() },
        { label: "Bullet list", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
        { label: "Numbered list", icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
        { label: "Quote", icon: Quote, active: editor.isActive("blockquote"), run: () => editor.chain().focus().toggleBlockquote().run() },
      ].map(item => <button key={item.label} type="button" aria-label={item.label} title={item.label} aria-pressed={item.active} onMouseDown={event => event.preventDefault()} onClick={item.run} className={buttonClass(item.active)}><item.icon className="h-4 w-4" /></button>)}
      <button type="button" aria-label="Add link" title="Add link" onMouseDown={event => event.preventDefault()} onClick={() => openDialog("link")} className={buttonClass(editor.isActive("link"))}><Link2 className="h-4 w-4" /></button>
      <button type="button" aria-label="Remove link" title="Remove link" disabled={!editor.isActive("link")} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().unsetLink().run()} className={buttonClass()}><Unlink className="h-4 w-4" /></button>
      <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => openDialog("images")} className={`${buttonClass()} flex items-center gap-1 text-xs`}><ImagePlus className="h-4 w-4" />Add pictures</button>
      <button type="button" aria-label="Clear formatting" title="Clear formatting" onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className={buttonClass()}><Eraser className="h-4 w-4" /></button>
      <button type="button" aria-label="Undo" title="Undo" disabled={!editor.can().undo()} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().undo().run()} className={buttonClass()}><Undo2 className="h-4 w-4" /></button>
      <button type="button" aria-label="Redo" title="Redo" disabled={!editor.can().redo()} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().redo().run()} className={buttonClass()}><Redo2 className="h-4 w-4" /></button>
    </div>
    <EditorContent editor={editor} />
    <p className="border-t px-4 py-2 text-xs text-muted-foreground">Select text to format it. Add pictures wherever the cursor is placed. Use Ctrl/Cmd+B for bold and Ctrl/Cmd+Z to undo.</p>
    {dialog && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="article-insert-title" className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border bg-background p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between gap-3"><h3 id="article-insert-title" className="font-bold">{dialog === "link" ? "Add a link" : "Add pictures"}</h3><button type="button" aria-label="Close insert dialog" disabled={uploading} onClick={() => setDialog(null)}><X className="h-5 w-5" /></button></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {dialog === "link" ? <form className="space-y-4" onSubmit={event => {
          event.preventDefault(); const href = linkUrl.trim();
          if (!validLink(href)) { setError("Enter a valid website, email or telephone link."); return; }
          const selected = editor.state.doc.textBetween(selection.current.from, selection.current.to, " ");
          const chain = editor.chain().focus().setTextSelection(selection.current);
          if (selected && selected === linkText) chain.setLink({ href }).run();
          else chain.insertContent({ type: "text", text: linkText.trim() || href, marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }] }).run();
          setDialog(null);
        }}>
          <label className="block text-sm space-y-1"><span>Text to display</span><input aria-label="Link text" value={linkText} onChange={event => setLinkText(event.target.value)} className="w-full rounded-lg border p-2.5" /></label>
          <label className="block text-sm space-y-1"><span>Link address *</span><input autoFocus aria-label="Link address" required value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://example.com" className="w-full rounded-lg border p-2.5" /></label>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm font-semibold">Insert link</button>
        </form> : <div className="space-y-4">
          <label className="block text-sm space-y-1"><span>Picture description (optional)</span><input aria-label="Picture description" disabled={uploading} value={imageAlt} onChange={event => setImageAlt(event.target.value)} className="w-full rounded-lg border p-2.5" /></label>
          <div className="space-y-2 rounded-lg border p-3">
            <label className="block text-sm font-semibold" htmlFor="article-pictures">Upload from your computer</label>
            <input id="article-pictures" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={event => { setFiles(Array.from(event.target.files || [])); setError(""); }} className="max-w-full text-sm" />
            <p className="text-xs text-muted-foreground">Up to 10 pictures at once, each 3 MB or smaller.</p>
            <button type="button" disabled={uploading || !files.length} onClick={uploadPictures} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm font-semibold disabled:opacity-50">{uploading ? "Uploading pictures…" : `Upload & insert${files.length ? ` (${files.length})` : ""}`}</button>
          </div>

        </div>}
      </section>
    </div>}
  </>;
}
