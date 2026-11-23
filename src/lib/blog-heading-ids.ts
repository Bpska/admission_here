import type { Root, Element, RootContent } from "hast";

function headingText(node: RootContent | Root): string {
  if (node.type === "text") return node.value;
  return "children" in node
    ? node.children.map((child) => headingText(child as RootContent)).join("")
    : "";
}
/** Runs after sanitizing HTML, so only our own scoped IDs become anchors. */
export function articleHeadings(scope: string) {
  return () => (tree: Root) => {
    let position = 0;
    function walk(node: Root | RootContent) {
      if (node.type === "element" && /^h[123]$/.test(node.tagName)) {
        // The page title is already H1. Body headings start at H2.
        if (node.tagName === "h1") node.tagName = "h2";
        const text = headingText(node).trim();
        if (text) {
          const slug = text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60);
          (node as Element).properties.id =
            `article-${scope.replace(/[^a-zA-Z0-9_-]/g, "")}-${++position}-${slug || "section"}`;
        }
      }
      if ("children" in node)
        node.children.forEach((child) => walk(child as RootContent));
    }
    walk(tree);
  };
}
