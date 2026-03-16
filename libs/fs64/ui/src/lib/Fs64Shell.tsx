import type { PropsWithChildren } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Drive1541Icon } from './Drive1541Icon';
import { FS64_THEME_OPTIONS, Fs64Theme, Fs64ThemeName } from '@fs64/theme';
import type { Fs64RemoteIcon } from '@fs64/registry';

type Fs64ShellNavItem = {
  id: string;
  label: string;
  route: string;
  icon?: Fs64RemoteIcon;
};

type Fs64ShellProps = PropsWithChildren<{
  theme: Fs64Theme;
  themeName: Fs64ThemeName;
  onThemeChange: (themeName: Fs64ThemeName) => void;
  navItems: Fs64ShellNavItem[];
}>;

export function Fs64Shell({ theme, themeName, onThemeChange, navItems, children }: Fs64ShellProps) {
  const homeRoute = navItems[0]?.route ?? '/';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at top, ${theme.panelAlt} 0%, ${theme.background} 58%)`,
        color: theme.text,
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem 0.95rem',
          borderBottom: `1px solid ${theme.border}`,
          background: theme.panelAlt,
          backdropFilter: 'blur(10px)',
          flexWrap: 'wrap',
        }}
      >
        <Link
          to={homeRoute}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            textDecoration: 'none',
            color: theme.text,
            minWidth: 0,
          }}
        >
          <Drive1541Icon theme={theme} width={56} height={42} />
          <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
            <div
              style={{
                fontSize: '1.45rem',
                lineHeight: 1,
                letterSpacing: '0.02em',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              FS64
            </div>
            <div style={{ display: 'grid', gap: 3, marginTop: 2, width: 82 }}>
              <span style={{ height: 3, width: '100%', background: theme.brandLine1 }} />
              <span style={{ height: 3, width: '100%', background: theme.brandLine2 }} />
              <span style={{ height: 3, width: '100%', background: theme.brandLine3 }} />
            </div>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {navItems.map((item) => (
              <ShellLink key={item.id} to={item.route}>
                {item.label}
              </ShellLink>
            ))}
          </nav>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              flexWrap: 'wrap',
              padding: '0.35rem 0.45rem',
              border: `1px solid ${theme.border}`,
              borderRadius: 999,
              background: theme.panel,
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                color: theme.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                paddingLeft: '0.15rem',
              }}
            >
              Theme
            </span>
            {FS64_THEME_OPTIONS.map((option) => {
              const active = option.name === themeName;
              return (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => onThemeChange(option.name)}
                  style={{
                    padding: '0.42rem 0.62rem',
                    border: `1px solid ${active ? theme.accent : 'transparent'}`,
                    borderRadius: 999,
                    background: active ? theme.panelAlt : 'transparent',
                    color: active ? theme.text : theme.muted,
                    opacity: active ? 1 : 0.92,
                    fontFamily: 'inherit',
                    fontSize: '0.76rem',
                    lineHeight: 1,
                  }}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <main style={{ padding: '1rem 1.25rem 1.5rem' }}>{children}</main>
    </div>
  );
}

function ShellLink({ to, children }: PropsWithChildren<{ to: string }>) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        padding: '0.48rem 0.72rem',
        border: '1px solid currentColor',
        borderRadius: 999,
        textDecoration: 'none',
        color: 'inherit',
        opacity: isActive ? 1 : 0.72,
        background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
      })}
    >
      {children}
    </NavLink>
  );
}
