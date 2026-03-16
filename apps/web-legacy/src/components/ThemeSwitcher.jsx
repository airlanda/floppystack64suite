import React from "react";
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from "reactstrap";

const THEMES = [
  { id: "c64-blue", label: "C64 Blue" },
  { id: "c64-screen", label: "C64 Screen" },
  { id: "c128-screen", label: "C128 Screen" },
  { id: "c64-dark", label: "C64 Dark" },
  { id: "atari-2600", label: "Atari 2600" },
  { id: "tron", label: "Tron" },
  { id: "star-wars", label: "Star Wars" },
  { id: "phosphor", label: "Phosphor" },
  { id: "amber", label: "Amber" },
  { id: "miami-night", label: "Miami Night" },
  { id: "vader", label: "Vader" },
  { id: "mono", label: "Mono" },
];

export default function ThemeSwitcher({ align = "end", compact = false }) {
  const [theme, setTheme] = React.useState(() => {
    return localStorage.getItem("floppystack-theme") || "c64-blue";
  });
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false
  );

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("floppystack-theme", theme);
  }, [theme]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(media.matches);
    onChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const activeLabel = THEMES.find(t => t.id === theme)?.label || theme;

  const chooseTheme = (nextTheme) => {
    setTheme(nextTheme);
  };

  if (isMobile) {
    return (
      <div className="theme-mobile-chip-row" aria-label={`Theme: ${activeLabel}`}>
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-mobile-chip${t.id === theme ? " is-active" : ""}`}
            onClick={() => chooseTheme(t.id)}
            aria-pressed={t.id === theme}
            title={t.label}
          >
            {t.label}
          </button>
        ))}
      </div>
    
    );
  }

  return (
    <UncontrolledDropdown className={compact ? "theme-switcher-compact" : "theme-switcher"}>
      <DropdownToggle
        color="dark"
        caret={!compact}
        className={`theme-toggle-btn ${compact ? "is-compact" : ""}`}
        title={`Theme: ${activeLabel}`}
        aria-label={`Theme: ${activeLabel}`}
      >
        {compact ? (
          <>
            <span className="theme-toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path className="theme-caret-icon" d="M6 9l6 6 6-6" />
              </svg>
            </span>
            <span className="visually-hidden">{`Theme: ${activeLabel}`}</span>
          </>
        ) : `Theme: ${activeLabel}`}
      </DropdownToggle>

      <DropdownMenu end={align === "end"} className="theme-dropdown-menu">
        {THEMES.map(t => (
          <DropdownItem
            className="theme-dropdown-item"
            color="dark"
            key={t.id}
            active={t.id === theme}
            onClick={() => chooseTheme(t.id)}
          >
            {t.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </UncontrolledDropdown>
  );
}
