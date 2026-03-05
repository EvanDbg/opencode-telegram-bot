import type { ModelInfo } from "../model/types.js";
import path from "node:path";
import { getRuntimePaths } from "../runtime/paths.js";
import { logger } from "../utils/logger.js";

export interface ProjectInfo {
  id: string;
  worktree: string;
  name?: string;
}

export interface SessionInfo {
  id: string;
  title: string;
  directory: string;
}

export interface ServerProcessInfo {
  pid: number;
  startTime: string;
}

export interface SessionDirectoryCacheInfo {
  version: 1;
  lastSyncedUpdatedAt: number;
  directories: Array<{
    worktree: string;
    lastUpdated: number;
  }>;
}

export interface Settings {
  scopedProjects?: Record<string, ProjectInfo>;
  scopedSessions?: Record<string, SessionInfo>;
  scopedAgents?: Record<string, string>;
  scopedModels?: Record<string, ModelInfo>;
  scopedPinnedMessageIds?: Record<string, number>;
  serverProcess?: ServerProcessInfo;
  sessionDirectoryCache?: SessionDirectoryCacheInfo;
}

const GLOBAL_SCOPE_KEY = "global";

function getSettingsFilePath(): string {
  return getRuntimePaths().settingsFilePath;
}

async function readSettingsFile(): Promise<Settings> {
  try {
    const fs = await import("fs/promises");
    const content = await fs.readFile(getSettingsFilePath(), "utf-8");
    return JSON.parse(content) as Settings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error("[SettingsManager] Error reading settings file:", error);
    }
    return {};
  }
}

let settingsWriteQueue: Promise<void> = Promise.resolve();

function writeSettingsFile(settings: Settings): Promise<void> {
  settingsWriteQueue = settingsWriteQueue
    .catch(() => {
      // Keep write queue alive after failed writes.
    })
    .then(async () => {
      try {
        const fs = await import("fs/promises");
        const settingsFilePath = getSettingsFilePath();
        await fs.mkdir(path.dirname(settingsFilePath), { recursive: true });
        await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
      } catch (err) {
        logger.error("[SettingsManager] Error writing settings file:", err);
      }
    });

  return settingsWriteQueue;
}

let currentSettings: Settings = {};

function getScopedMap<T>(map: Record<string, T> | undefined, scopeKey: string): T | undefined {
  return map?.[scopeKey];
}

function setScopedMapValue<T>(
  map: Record<string, T> | undefined,
  scopeKey: string,
  value: T,
): Record<string, T> {
  return {
    ...(map ?? {}),
    [scopeKey]: value,
  };
}

function clearScopedMapValue<T>(
  map: Record<string, T> | undefined,
  scopeKey: string,
): Record<string, T> | undefined {
  if (!map || !(scopeKey in map)) {
    return map;
  }

  const rest = Object.fromEntries(
    Object.entries(map).filter(([key]) => key !== scopeKey),
  ) as Record<string, T>;

  return Object.keys(rest).length > 0 ? rest : undefined;
}

export function getCurrentProject(scopeKey: string = GLOBAL_SCOPE_KEY): ProjectInfo | undefined {
  return getScopedMap(currentSettings.scopedProjects, scopeKey);
}

export function setCurrentProject(
  projectInfo: ProjectInfo,
  scopeKey: string = GLOBAL_SCOPE_KEY,
): void {
  currentSettings.scopedProjects = setScopedMapValue(
    currentSettings.scopedProjects,
    scopeKey,
    projectInfo,
  );
  void writeSettingsFile(currentSettings);
}

export function clearProject(scopeKey: string = GLOBAL_SCOPE_KEY): void {
  currentSettings.scopedProjects = clearScopedMapValue(currentSettings.scopedProjects, scopeKey);
  void writeSettingsFile(currentSettings);
}

export function getCurrentSession(scopeKey: string = GLOBAL_SCOPE_KEY): SessionInfo | undefined {
  return getScopedMap(currentSettings.scopedSessions, scopeKey);
}

export function setCurrentSession(
  sessionInfo: SessionInfo,
  scopeKey: string = GLOBAL_SCOPE_KEY,
): void {
  currentSettings.scopedSessions = setScopedMapValue(
    currentSettings.scopedSessions,
    scopeKey,
    sessionInfo,
  );
  void writeSettingsFile(currentSettings);
}

export function clearSession(scopeKey: string = GLOBAL_SCOPE_KEY): void {
  currentSettings.scopedSessions = clearScopedMapValue(currentSettings.scopedSessions, scopeKey);
  void writeSettingsFile(currentSettings);
}

export function getScopedSessions(): Record<string, SessionInfo> {
  return { ...(currentSettings.scopedSessions ?? {}) };
}

export function setScopedSession(scopeKey: string, sessionInfo: SessionInfo): void {
  setCurrentSession(sessionInfo, scopeKey);
}

export function clearScopedSession(scopeKey: string): void {
  clearSession(scopeKey);
}

export function getCurrentAgent(scopeKey: string = GLOBAL_SCOPE_KEY): string | undefined {
  return getScopedMap(currentSettings.scopedAgents, scopeKey);
}

export function setCurrentAgent(agentName: string, scopeKey: string = GLOBAL_SCOPE_KEY): void {
  currentSettings.scopedAgents = setScopedMapValue(
    currentSettings.scopedAgents,
    scopeKey,
    agentName,
  );
  void writeSettingsFile(currentSettings);
}

export function clearCurrentAgent(scopeKey: string = GLOBAL_SCOPE_KEY): void {
  currentSettings.scopedAgents = clearScopedMapValue(currentSettings.scopedAgents, scopeKey);
  void writeSettingsFile(currentSettings);
}

export function getCurrentModel(scopeKey: string = GLOBAL_SCOPE_KEY): ModelInfo | undefined {
  return getScopedMap(currentSettings.scopedModels, scopeKey);
}

export function setCurrentModel(modelInfo: ModelInfo, scopeKey: string = GLOBAL_SCOPE_KEY): void {
  currentSettings.scopedModels = setScopedMapValue(
    currentSettings.scopedModels,
    scopeKey,
    modelInfo,
  );
  void writeSettingsFile(currentSettings);
}

export function clearCurrentModel(scopeKey: string = GLOBAL_SCOPE_KEY): void {
  currentSettings.scopedModels = clearScopedMapValue(currentSettings.scopedModels, scopeKey);
  void writeSettingsFile(currentSettings);
}

export function getScopedPinnedMessageId(scopeKey: string): number | undefined {
  return getScopedMap(currentSettings.scopedPinnedMessageIds, scopeKey);
}

export function setScopedPinnedMessageId(scopeKey: string, messageId: number): void {
  currentSettings.scopedPinnedMessageIds = setScopedMapValue(
    currentSettings.scopedPinnedMessageIds,
    scopeKey,
    messageId,
  );
  void writeSettingsFile(currentSettings);
}

export function clearScopedPinnedMessageId(scopeKey: string): void {
  currentSettings.scopedPinnedMessageIds = clearScopedMapValue(
    currentSettings.scopedPinnedMessageIds,
    scopeKey,
  );
  void writeSettingsFile(currentSettings);
}

export function getServerProcess(): ServerProcessInfo | undefined {
  return currentSettings.serverProcess;
}

export function setServerProcess(processInfo: ServerProcessInfo): void {
  currentSettings.serverProcess = processInfo;
  void writeSettingsFile(currentSettings);
}

export function clearServerProcess(): void {
  currentSettings.serverProcess = undefined;
  void writeSettingsFile(currentSettings);
}

export function getSessionDirectoryCache(): SessionDirectoryCacheInfo | undefined {
  return currentSettings.sessionDirectoryCache;
}

export function setSessionDirectoryCache(cache: SessionDirectoryCacheInfo): Promise<void> {
  currentSettings.sessionDirectoryCache = cache;
  return writeSettingsFile(currentSettings);
}

export function clearSessionDirectoryCache(): void {
  currentSettings.sessionDirectoryCache = undefined;
  void writeSettingsFile(currentSettings);
}

export function __resetSettingsForTests(): void {
  currentSettings = {};
  settingsWriteQueue = Promise.resolve();
}

export async function loadSettings(): Promise<void> {
  const loadedSettings = (await readSettingsFile()) as Settings & {
    toolMessagesIntervalSec?: unknown;
    currentProject?: unknown;
    currentSession?: unknown;
    currentAgent?: unknown;
    currentModel?: unknown;
    pinnedMessageId?: unknown;
  };

  let dirty = false;

  if ("toolMessagesIntervalSec" in loadedSettings) {
    delete loadedSettings.toolMessagesIntervalSec;
    dirty = true;
  }

  if ("currentProject" in loadedSettings) {
    delete loadedSettings.currentProject;
    dirty = true;
  }
  if ("currentSession" in loadedSettings) {
    delete loadedSettings.currentSession;
    dirty = true;
  }
  if ("currentAgent" in loadedSettings) {
    delete loadedSettings.currentAgent;
    dirty = true;
  }
  if ("currentModel" in loadedSettings) {
    delete loadedSettings.currentModel;
    dirty = true;
  }
  if ("pinnedMessageId" in loadedSettings) {
    delete loadedSettings.pinnedMessageId;
    dirty = true;
  }

  currentSettings = loadedSettings;

  if (dirty) {
    void writeSettingsFile(currentSettings);
  }
}
