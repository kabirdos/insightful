"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Menu,
  X,
  Search,
  Upload,
  LogOut,
  User,
  TrendingUp,
  Home,
  Sparkles,
  ChevronDown,
  GitFork,
} from "lucide-react";
import clsx from "clsx";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/top", label: "Top", icon: TrendingUp },
  { href: "/search", label: "Search", icon: Search },
];

export default function Header() {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          <Sparkles className="h-6 w-6 text-blue-600" />
          <span>Insightful</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop Right */}
        <div className="hidden items-center gap-3 md:flex">
          {status === "loading" ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          ) : session?.user ? (
            <>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Link>

              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                  <ChevronDown
                    className={clsx(
                      "h-4 w-4 text-slate-400 transition-transform",
                      dropdownOpen && "rotate-180",
                    )}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <div className="border-b border-slate-100 px-4 py-2 dark:border-slate-700">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {session.user.name || "User"}
                      </p>
                    </div>
                    <Link
                      href={`/u/${session.user.username}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <Link
                      href="/upload"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Report
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => signIn("github")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <GitFork className="h-4 w-4" />
              Sign in with GitHub
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white pb-4 md:hidden dark:border-slate-800 dark:bg-slate-950">
          <nav className="flex flex-col gap-1 px-4 pt-3">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 border-t border-slate-200 px-4 pt-3 dark:border-slate-700">
            {session?.user ? (
              <div className="flex flex-col gap-1">
                <Link
                  href="/upload"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400"
                >
                  <Upload className="h-4 w-4" />
                  Upload Report
                </Link>
                <Link
                  href={`/u/${session.user.username}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <button
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("github")}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <GitFork className="h-4 w-4" />
                Sign in with GitHub
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
