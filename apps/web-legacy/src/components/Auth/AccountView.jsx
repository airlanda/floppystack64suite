import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Floppy from "../Floppy";
import "./AccountView.css";

function AccountView({ authUser, authLoading, authError, onLogin, onRegister, onLogout }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [callsign, setCallsign] = useState("");
  const [localError, setLocalError] = useState("");

  const busy = Boolean(authLoading);
  const formError = useMemo(() => localError || authError || "", [localError, authError]);

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setDisplayName("");
    setCallsign("");
    setLocalError("");
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setLocalError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError("");

    const safeUser = username.trim();
    if (!safeUser) {
      setLocalError("Username is required.");
      return;
    }

    if (!password) {
      setLocalError("Password is required.");
      return;
    }

    if (mode === "register") {
      if (!callsign.trim()) {
        setLocalError("Callsign is required.");
        return;
      }
      const result = await onRegister?.({
        username: safeUser,
        password,
        displayName: displayName.trim(),
        callsign: callsign.trim(),
      });
      if (!result?.ok) return;
      resetForm();
      return;
    }

    const result = await onLogin?.({ username: safeUser, password });
    if (!result?.ok) return;
    resetForm();
  };

  return (
    <div className="account-view-root">
      <div className="account-view-stage" aria-hidden="true">
        <Floppy className="account-view-floppy" />
      </div>

      <section className="account-view-card" aria-label="Profile">
        <header className="account-view-header">
          <h2>Profile</h2>
          <p>Sign in to track badges, sessions, and play stats.</p>
        </header>

        {authUser ? (
          <div className="account-view-session">
            <div className="account-view-session-kicker">Signed in as</div>
            <div className="account-view-session-name">{authUser.callsign || authUser.displayName || authUser.username}</div>
            <div className="account-view-session-user">{authUser.username}</div>
            <button
              type="button"
              className="account-view-btn"
              onClick={onLogout}
              disabled={busy}
            >
              {busy ? "Working..." : "Logout"}
            </button>
          </div>
        ) : (
          <>
            <div className="account-view-mode-switch" role="tablist" aria-label="Profile action">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={`account-view-chip ${mode === "login" ? "is-active" : ""}`}
                onClick={() => handleModeChange("login")}
              >
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={`account-view-chip ${mode === "register" ? "is-active" : ""}`}
                onClick={() => handleModeChange("register")}
              >
                Join
              </button>
            </div>

            <form className="account-view-form" onSubmit={handleSubmit}>
              <label className="account-view-field">
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  disabled={busy}
                />
              </label>

              {mode === "register" ? (
                <label className="account-view-field">
                  <span>Display Name</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="nickname"
                    disabled={busy}
                  />
                </label>
              ) : null}

              {mode === "register" ? (
                <label className="account-view-field">
                  <span>Callsign</span>
                  <input
                    type="text"
                    value={callsign}
                    onChange={(event) => setCallsign(event.target.value)}
                    autoComplete="nickname"
                    placeholder="ARCADE ACE"
                    disabled={busy}
                  />
                </label>
              ) : null}

              <label className="account-view-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  disabled={busy}
                />
              </label>

              {formError ? <div className="account-view-error">{formError}</div> : null}

              <button type="submit" className="account-view-btn" disabled={busy}>
                {busy ? "Working..." : mode === "register" ? "Create Profile" : "Sign In"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

AccountView.propTypes = {
  authUser: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    displayName: PropTypes.string,
    callsign: PropTypes.string,
  }),
  authLoading: PropTypes.bool,
  authError: PropTypes.string,
  onLogin: PropTypes.func,
  onRegister: PropTypes.func,
  onLogout: PropTypes.func,
};

export default AccountView;
