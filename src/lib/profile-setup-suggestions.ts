// Autosuggest lists for the profile setup edit form. Consumed by
// <datalist> elements so users can pick common values or type freely.
// Ordering reflects rough popularity / recency to make the dropdown useful
// at a glance. Not a strict enum — all fields accept arbitrary free text.

export const OS_SUGGESTIONS = [
  "macOS",
  "Linux",
  "Windows",
  "WSL (Windows)",
  "NixOS",
  "Arch Linux",
  "Ubuntu",
  "Fedora",
  "Debian",
];

export const EDITOR_SUGGESTIONS = [
  "VS Code",
  "Cursor",
  "Zed",
  "Neovim",
  "Vim",
  "Emacs",
  "JetBrains (IntelliJ)",
  "JetBrains (WebStorm)",
  "JetBrains (PyCharm)",
  "JetBrains (GoLand)",
  "Windsurf",
  "Sublime Text",
  "Xcode",
  "Visual Studio",
];

export const TERMINAL_SUGGESTIONS = [
  "Ghostty",
  "iTerm2",
  "Warp",
  "Alacritty",
  "Kitty",
  "WezTerm",
  "Terminal.app",
  "Windows Terminal",
  "Hyper",
  "Tabby",
];

export const SHELL_SUGGESTIONS = [
  "zsh",
  "bash",
  "fish",
  "nushell",
  "PowerShell",
];

export const PRIMARY_AGENT_SUGGESTIONS = [
  "Claude Code",
  "Codex",
  "Cursor Agent",
  "Aider",
  "Amp",
  "Cline",
  "Continue",
  "GitHub Copilot Workspace",
];

export const PRIMARY_MODEL_SUGGESTIONS = [
  "claude-opus-4",
  "claude-sonnet-4",
  "claude-haiku-4",
  "claude-opus-3.5",
  "claude-sonnet-3.5",
  "gpt-5",
  "gpt-4.1",
  "o3",
  "o4-mini",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
];

export const PACKAGE_MANAGER_SUGGESTIONS = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
  "uv",
  "pip",
  "poetry",
  "cargo",
  "go modules",
  "mise",
  "asdf",
];
