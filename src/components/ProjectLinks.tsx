"use client";

import { useState } from "react";
import { GitFork, ExternalLink, Globe } from "lucide-react";
import clsx from "clsx";

/**
 * Defense-in-depth client-side check for image URLs extracted from
 * untrusted OG metadata. The server-side fetchLinkPreview already
 * runs isSafeUrl against these URLs before persisting, but this
 * secondary synchronous check catches:
 *
 *   1. Private / loopback / link-local hostnames that resolve via
 *      the CLIENT's DNS (e.g., a corporate intranet with .corp
 *      hostnames pointing at internal services — the server's DNS
 *      can't see those, but the client's browser can)
 *   2. Stored data from an earlier code path that didn't have the
 *      server-side check yet
 *
 * Returns false for anything that looks non-public at a glance. We
 * can't do DNS resolution client-side, so this is hostname-pattern
 * only — a strict subset of the server check's coverage.
 */
function looksLikePublicUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  const h = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return false;
  if (h === "localhost" || h === "0.0.0.0") return false;
  // IPv4 private / loopback / link-local ranges
  if (/^127\./.test(h)) return false;
  if (/^10\./.test(h)) return false;
  if (/^192\.168\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (/^169\.254\./.test(h)) return false;
  if (/^0\./.test(h)) return false;
  // IPv6 loopback + link-local + IPv4-mapped
  if (h === "::1") return false;
  if (h.startsWith("fe80:")) return false;
  if (h.startsWith("::ffff:")) return false;
  // Common private-use TLDs — not a perfect list but catches the
  // usual suspects without being too restrictive on real hosts.
  if (/\.(local|internal|corp|lan|home|intranet)$/i.test(h)) return false;
  return true;
}

/**
 * Shape consumed by this component. Matches the fields we persist on
 * the Project model. All OG metadata fields are optional because
 * (a) they may not have been fetched yet and (b) the caller may pass
 * a Project with only a githubUrl and no live site to preview.
 */
export interface ProjectCardData {
  id: string;
  name: string;
  githubUrl?: string | null;
  liveUrl?: string | null;
  description?: string | null;
  ogImage?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  favicon?: string | null;
  siteName?: string | null;
}

interface ProjectLinksProps {
  links: ProjectCardData[];
  className?: string;
}

export default function ProjectLinks({ links, className }: ProjectLinksProps) {
  if (!links || links.length === 0) return null;

  return (
    <div className={clsx("space-y-4", className)}>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Projects
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <ProjectCard key={link.id} link={link} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ link }: { link: ProjectCardData }) {
  // Per-card local state so one broken ogImage doesn't hide the rest
  // of the card — just its image block.
  const [imageFailed, setImageFailed] = useState(false);

  // Defense-in-depth: the server-side fetcher runs isSafeUrl on these
  // URLs before persisting, but we also double-check client-side so
  // stored data from earlier code paths AND corporate-intranet names
  // that the server can't resolve still get filtered here.
  const safeOgImage = looksLikePublicUrl(link.ogImage) ? link.ogImage : null;
  const safeFavicon = looksLikePublicUrl(link.favicon) ? link.favicon : null;

  const showImage = Boolean(safeOgImage) && !imageFailed;
  const showSiteRow = Boolean(link.siteName) || Boolean(safeFavicon);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50">
      {showImage && safeOgImage && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
          {/* Plain <img> on purpose — OG images come from arbitrary
              third-party hosts and next/image would require wildcard
              remotePatterns in next.config.ts. URL has been gated by
              looksLikePublicUrl above. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={safeOgImage}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div className="p-4">
        {showSiteRow && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {safeFavicon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeFavicon}
                alt=""
                className="h-4 w-4 rounded-sm"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            {link.siteName && <span className="truncate">{link.siteName}</span>}
          </div>
        )}
        <h4 className="truncate font-medium text-slate-900 dark:text-slate-100">
          {link.name}
        </h4>
        {link.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
            {link.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-1.5">
          {link.githubUrl && (
            <a
              href={link.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label={`${link.name} on GitHub`}
            >
              <GitFork className="h-4 w-4" />
            </a>
          )}
          {link.liveUrl && (
            <a
              href={link.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label={`Visit ${link.name}`}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {!link.githubUrl && !link.liveUrl && (
            <div className="rounded-lg p-2 text-slate-300 dark:text-slate-600">
              <Globe className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
