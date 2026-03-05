import {
  getCurrentSession as getSettingsSession,
  getScopedSessions,
  setCurrentSession as setSettingsSession,
  clearSession as clearSettingsSession,
  SessionInfo,
} from "../settings/manager.js";

export type { SessionInfo };

const GLOBAL_SCOPE_KEY = "global";

const sessionsByScope = new Map<string, SessionInfo>();
const scopeBySessionId = new Map<string, string>();
let hydrated = false;

function ensureSessionsLoaded(): void {
  if (hydrated) {
    return;
  }

  hydrated = true;

  const scopedSessions = getScopedSessions();
  for (const [scopeKey, sessionInfo] of Object.entries(scopedSessions)) {
    sessionsByScope.set(scopeKey, sessionInfo);
    scopeBySessionId.set(sessionInfo.id, scopeKey);
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
  ensureSessionsLoaded();

  const previous = sessionsByScope.get(scopeKey);
  if (previous && previous.id !== sessionInfo.id) {
    scopeBySessionId.delete(previous.id);
  }

  sessionsByScope.set(scopeKey, sessionInfo);
  scopeBySessionId.set(sessionInfo.id, scopeKey);

  if (scopeKey === GLOBAL_SCOPE_KEY) {
    setSettingsSession(sessionInfo, scopeKey);
    return;
  }

  setSettingsSession(sessionInfo, scopeKey);
}

export function getCurrentSession(scopeKey: string = GLOBAL_SCOPE_KEY): SessionInfo | null {
  ensureSessionsLoaded();
  return sessionsByScope.get(scopeKey) ?? null;
}

export function clearSession(scopeKey: string = GLOBAL_SCOPE_KEY): void {
  ensureSessionsLoaded();

  const session = sessionsByScope.get(scopeKey);
  if (session) {
    scopeBySessionId.delete(session.id);
  }

  sessionsByScope.delete(scopeKey);

  if (scopeKey === GLOBAL_SCOPE_KEY) {
    clearSettingsSession(scopeKey);
    return;
  }

  clearSettingsSession(scopeKey);
}

export function getScopeForSession(sessionId: string): string | null {
  ensureSessionsLoaded();
  return scopeBySessionId.get(sessionId) ?? null;
}

export function registerSessionScope(sessionId: string, scopeKey: string): void {
  ensureSessionsLoaded();
  scopeBySessionId.set(sessionId, scopeKey);

  const sessionInfo = sessionsByScope.get(scopeKey);
  if (!sessionInfo || sessionInfo.id !== sessionId) {
    return;
  }

  setSettingsSession(sessionInfo, scopeKey);
}

export function getSessionById(sessionId: string): SessionInfo | null {
  ensureSessionsLoaded();
  const scopeKey = scopeBySessionId.get(sessionId);
  if (!scopeKey) {
    return null;
  }

  return sessionsByScope.get(scopeKey) ?? null;
}
