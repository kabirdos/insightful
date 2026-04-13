"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { isSafeImageDataUri } from "@/lib/safe-image";

// Custom sanitize schema layered on top of rehype-sanitize's default. We
// keep the default's tag/attribute allowlist (which already strips <script>,
// event handlers, etc.) and tighten <img> to require a data:image/{png,jpeg}
// src — http(s) images are stripped to prevent tracking pixels and external
// requests. Anchors get target/rel attributes for safe new-tab opening.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? [])],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    img: ["src", "alt", "title"],
    a: [
      ...((defaultSchema.attributes ?? {}).a ?? []),
      ["target", "_blank"],
      ["rel", "noopener", "noreferrer"],
    ],
  },
  protocols: {
    // Drop the default http/https/etc. for img.src; only data: passes through,
    // and we further constrain it via urlTransform below.
    ...(defaultSchema.protocols ?? {}),
    src: ["data"],
  },
} as const;

// urlTransform runs BEFORE the sanitizer on every href/src that markdown
// produces. Returning an empty string makes react-markdown render the node
// as plain text — nothing reaches the DOM.
function safeUrlTransform(url: string): string {
  if (!url) return "";
  // Allow fragment links (TOC anchors)
  if (url.startsWith("#")) return url;
  // Allow mailto
  if (url.startsWith("mailto:")) return url;
  // Allow data: image URIs but only the png/jpeg base64 shape (defense in
  // depth — the sanitizer schema also restricts img protocols to data:)
  if (url.startsWith("data:")) {
    return isSafeImageDataUri(url) ? url : "";
  }
  // Allow http(s) for links only — img is constrained by the sanitize schema
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Anything else (javascript:, vbscript:, file:, mixed-case schemes that
  // would otherwise slip through, etc.) is dropped
  return "";
}

interface SkillReadmeProps {
  markdown: string;
}

export function SkillReadme({ markdown }: SkillReadmeProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      urlTransform={safeUrlTransform}
      components={{
        a: ({ node: _node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
        // When safeUrlTransform strips an image src to "", react-markdown
        // still emits an <img src="">, which makes the browser re-fetch the
        // current page. Render nothing instead.
        img: ({ node: _node, src, alt, ...props }) => {
          if (typeof src !== "string" || src.length === 0) return null;
          return <img src={src} alt={alt ?? ""} {...props} />;
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

// Exported for tests
export const _internal = { sanitizeSchema, safeUrlTransform };
