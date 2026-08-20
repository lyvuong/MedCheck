import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "medcheck_theme";

function readStoredTheme(): Theme | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme);
  const effective = stored ?? systemTheme();

  useEffect(() => {
    if (stored) {
      document.documentElement.setAttribute("data-theme", stored);
      localStorage.setItem(STORAGE_KEY, stored);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", effective === "dark" ? "#0b1220" : "#f8fafc");
  }, [stored, effective]);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setStored(effective === "dark" ? "light" : "dark")}
      aria-label={`Switch to ${effective === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${effective === "dark" ? "light" : "dark"} mode`}
    >
      {effective === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
