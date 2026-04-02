"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import {
  MessageSquare,
  Reply,
  Send,
  User,
  LogIn,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import clsx from "clsx";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  replies?: Comment[];
}

interface CommentSectionProps {
  reportId: string;
  slug: string;
  comments: Comment[];
  className?: string;
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function CommentItem({
  comment,
  slug,
  depth = 0,
}: {
  comment: Comment;
  slug: string;
  depth?: number;
}) {
  const { data: session } = useSession();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  async function handleReply() {
    if (!replyBody.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await fetch(`/api/insights/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: comment.id,
          body: replyBody.trim(),
        }),
      });
      setReplyBody("");
      setShowReplyForm(false);
      // In a real app, we'd refetch or optimistically update
    } catch {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={clsx(
        depth > 0 &&
          "ml-8 border-l-2 border-slate-100 pl-4 dark:border-slate-800",
      )}
    >
      <div className="flex gap-3 py-3">
        {comment.author.avatarUrl ? (
          <Image
            src={comment.author.avatarUrl}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full shrink-0"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
            <User className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {comment.author.displayName || comment.author.username}
            </span>
            <span className="text-xs text-slate-400">
              {formatTimeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {comment.body}
          </p>
          <div className="mt-2 flex items-center gap-3">
            {session && depth === 0 && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            )}
            {comment.replies && comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showReplies ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {comment.replies.length}{" "}
                {comment.replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-600 dark:focus:bg-slate-800"
                onKeyDown={(e) => e.key === "Enter" && handleReply()}
              />
              <button
                onClick={handleReply}
                disabled={!replyBody.trim() || isSubmitting}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {showReplies &&
        comment.replies?.map((reply) => (
          <CommentItem
            key={reply.id}
            comment={reply}
            slug={slug}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export default function CommentSection({
  reportId,
  slug,
  comments: initialComments,
  className,
}: CommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/insights/${slug}/comments`)
      .then((r) => r.json())
      .then((json) => setComments(json.data || []))
      .catch(() => {});
  }, [slug]);

  async function handleSubmit() {
    if (!body.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/insights/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setComments((prev) => [json.data, ...prev]);
        setBody("");
      }
    } catch {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={clsx("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-slate-400" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Comments{" "}
          <span className="text-sm font-normal text-slate-400">
            ({comments.length})
          </span>
        </h3>
      </div>

      {/* Add Comment */}
      {session ? (
        <div className="flex gap-3">
          {session.user?.image ? (
            <Image
              src={session.user.image}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full shrink-0"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
              <User className="h-4 w-4" />
            </div>
          )}
          <div className="flex flex-1 gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-400 focus:bg-white resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-600"
            />
            <button
              onClick={handleSubmit}
              disabled={!body.trim() || isSubmitting}
              className="self-end rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <LogIn className="h-4 w-4" />
            Sign in to leave a comment
          </div>
        </div>
      )}

      {/* Comments List */}
      {comments.length > 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} slug={slug} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No comments yet. Be the first to share your thoughts!
        </p>
      )}
    </div>
  );
}
