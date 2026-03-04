import {
  getCurrentSession as getSettingsSession,
  setCurrentSession as setSettingsSession,
  clearSession as clearSettingsSession,
  SessionInfo,
} from "../settings/manager.js";

export type { SessionInfo };

const GLOBAL_SCOPE_KEY = "global";

const sessionsByScope = new Map<string, SessionInfo>();
const scopeBySessionId = new Map<string, string>();

function ensureGlobalSessionLoaded(): void {
  if (sessionsByScope.has(GLOBAL_SCOPE_KEY)) {
    return;
  }

  const settingsSession = getSettingsSession();
  if (!settingsSession) {
    return;
  }

  sessionsByScope.set(GLOBAL_SCOPE_KEY, settingsSession);
  scopeBySessionId.set(settingsSession.id, GLOBAL_SCOPE_KEY);
}

export function setCurrentSession(
  sessionInfo: SessionInfo,
  scopeKey: string = GLOBAL_SCOPE_KEY,
): void {
  const previous = sessionsByScope.get(scopeKey);
  if (previous && previous.id !== sessionInfo.id) {
    scopeBySessionId.delete(previous.id);
  }

  sessionsByScope.set(scopeKey, sessionInfo);
  scopeBySessionId.set(sessionInfo.id, scopeKey);

  if (scopeKey === GLOBAL_SCOPE_KEY) {
    setSettingsSession(sessionInfo);
  }
}

export function getCurrentSession(scopeKey: string = GLOBAL_SCOPE_KEY): SessionInfo | null {
  ensureGlobalSessionLoaded();
  return sessionsByScope.get(scopeKey) ?? null;
}

export function clearSession(scopeKey: string = GLOBAL_SCOPE_KEY): void {
  ensureGlobalSessionLoaded();

  const session = sessionsByScope.get(scopeKey);
  if (session) {
    scopeBySessionId.delete(session.id);
  }

  sessionsByScope.delete(scopeKey);

  if (scopeKey === GLOBAL_SCOPE_KEY) {
    clearSettingsSession();
  }
}

export function getScopeForSession(sessionId: string): string | null {
  return scopeBySessionId.get(sessionId) ?? null;
}

export function registerSessionScope(sessionId: string, scopeKey: string): void {
  scopeBySessionId.set(sessionId, scopeKey);
}

export function getSessionById(sessionId: string): SessionInfo | null {
  const scopeKey = scopeBySessionId.get(sessionId);
  if (!scopeKey) {
    return null;
  }

  return sessionsByScope.get(scopeKey) ?? null;
}
