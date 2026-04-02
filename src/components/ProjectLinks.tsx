"use client";

import { GitFork, ExternalLink, Globe } from "lucide-react";
import clsx from "clsx";

interface ProjectLink {
  id: string;
  name: string;
  githubUrl?: string | null;
  liveUrl?: string | null;
  description?: string | null;
}

interface ProjectLinksProps {
  links: ProjectLink[];
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
          <div
            key={link.id}
            className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                  {link.name}
                </h4>
                {link.description && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                    {link.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
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
        ))}
      </div>
    </div>
  );
}
