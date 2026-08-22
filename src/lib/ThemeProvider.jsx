import { useEffect } from "react";
import { useApp } from "./AppContext";
import { DEFAULT_THEMES } from "../data/seed";

export default function ThemeProvider({ children }) {
  const { data } = useApp();
  const theme = data.themes?.[data.activeRole] || DEFAULT_THEMES[data.activeRole] || DEFAULT_THEMES.owner;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-alt", theme.accentAlt);
    root.classList.toggle("light", theme.mode === "light");
  }, [theme.accent, theme.accentAlt, theme.mode]);

  return children;
}
