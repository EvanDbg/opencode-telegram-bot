import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot, Context } from "grammy";
import { processUserPrompt } from "../../../src/bot/handlers/prompt.js";

const mocked = vi.hoisted(() => ({
  summarizeMock: vi.fn(),
  promptMock: vi.fn(),
  commandMock: vi.fn(),
  currentProject: { id: "project-1", worktree: "D:/repo" } as
    | { id: string; worktree: string }
    | undefined,
  currentSession: {
    id: "session-1",
    title: "Session",
    directory: "D:/repo",
  } as { id: string; title: string; directory: string } | undefined,
  currentAgent: "Hephaestus",
  currentModel: { providerID: "cliproxyapi", modelID: "gpt-5.3-codex", variant: "default" },
}));

vi.mock("../../../src/opencode/client.js", () => ({
  opencodeClient: {
    session: {
      summarize: mocked.summarizeMock,
      prompt: mocked.promptMock,
      command: mocked.commandMock,
      status: vi.fn().mockResolvedValue({ data: {}, error: null }),
      create: vi.fn(),
    },
  },
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: vi.fn(() => mocked.currentProject),
}));

vi.mock("../../../src/session/manager.js", () => ({
  getCurrentSession: vi.fn(() => mocked.currentSession),
  setCurrentSession: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock("../../../src/session/cache-manager.js", () => ({
  ingestSessionInfoForCache: vi.fn(),
  __resetSessionDirectoryCacheForTests: vi.fn(),
}));

vi.mock("../../../src/agent/manager.js", () => ({
  getStoredAgent: vi.fn(() => mocked.currentAgent),
}));

vi.mock("../../../src/model/manager.js", () => ({
  getStoredModel: vi.fn(() => mocked.currentModel),
}));

vi.mock("../../../src/variant/manager.js", () => ({
  formatVariantForButton: vi.fn(() => "default"),
}));

vi.mock("../../../src/bot/utils/keyboard.js", () => ({
  createMainKeyboard: vi.fn(),
}));

vi.mock("../../../src/keyboard/manager.js", () => ({
  keyboardManager: {
    initialize: vi.fn(),
    clearContext: vi.fn(),
  },
}));

vi.mock("../../../src/pinned/manager.js", () => ({
  pinnedMessageManager: {
    isInitialized: vi.fn(() => true),
    initialize: vi.fn(),
    onSessionChange: vi.fn(),
    getState: vi.fn(() => ({ messageId: 1 })),
    getContextInfo: vi.fn(() => null),
    clear: vi.fn(),
  },
}));

vi.mock("../../../src/summary/aggregator.js", () => ({
  summaryAggregator: {
    setSession: vi.fn(),
    setBotAndChatId: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("../../../src/opencode/events.js", () => ({
  stopEventListening: vi.fn(),
}));

vi.mock("../../../src/interaction/manager.js", () => ({
  interactionManager: {
    getSnapshot: vi.fn(() => null),
    clear: vi.fn(),
  },
}));

vi.mock("../../../src/interaction/cleanup.js", () => ({
  clearAllInteractionState: vi.fn(),
}));

vi.mock("../../../src/utils/safe-background-task.js", () => ({
  safeBackgroundTask: ({
    task,
    onSuccess,
    onError,
  }: {
    task: () => Promise<unknown>;
    onSuccess?: (value: unknown) => void | Promise<void>;
    onError?: (error: unknown) => void | Promise<void>;
  }) => {
    void task()
      .then((result) => {
        if (onSuccess) {
          void onSuccess(result);
        }
      })
      .catch((error) => {
        if (onError) {
          void onError(error);
        }
      });
  },
}));

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

vi.mock("../../../src/utils/error-format.js", () => ({
  formatErrorDetails: vi.fn(() => "error"),
}));

function createContext(): Context {
  return {
    chat: { id: 777 },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context;
}

describe("bot/handlers/prompt compact slash bridge", () => {
  beforeEach(() => {
    mocked.summarizeMock.mockReset();
    mocked.promptMock.mockReset();
    mocked.commandMock.mockReset();
  });

  it("routes /compact to session.summarize instead of session.prompt", async () => {
    mocked.summarizeMock.mockResolvedValue({ error: null });

    const ctx = createContext();
    const result = await processUserPrompt(
      ctx,
      "/compact",
      { bot: {} as Bot<Context>, ensureEventSubscription: vi.fn().mockResolvedValue(undefined) },
      [],
    );

    expect(result).toBe(true);
    expect(mocked.summarizeMock).toHaveBeenCalledWith({
      sessionID: "session-1",
      directory: "D:/repo",
      providerID: "cliproxyapi",
      modelID: "gpt-5.3-codex",
    });
    expect(mocked.promptMock).not.toHaveBeenCalled();
    expect(mocked.commandMock).not.toHaveBeenCalled();
  });

  it("routes /summarize alias to session.summarize", async () => {
    mocked.summarizeMock.mockResolvedValue({ error: null });

    const ctx = createContext();
    await processUserPrompt(
      ctx,
      "/summarize now",
      { bot: {} as Bot<Context>, ensureEventSubscription: vi.fn().mockResolvedValue(undefined) },
      [],
    );

    expect(mocked.summarizeMock).toHaveBeenCalledTimes(1);
    expect(mocked.promptMock).not.toHaveBeenCalled();
    expect(mocked.commandMock).not.toHaveBeenCalled();
  });

  it("routes generic slash commands like /share to session.command", async () => {
    mocked.commandMock.mockResolvedValue({ error: null });

    const ctx = createContext();
    const result = await processUserPrompt(
      ctx,
      "/share now",
      { bot: {} as Bot<Context>, ensureEventSubscription: vi.fn().mockResolvedValue(undefined) },
      [],
    );

    await flushMicrotasks();

    expect(result).toBe(true);
    expect(mocked.commandMock).toHaveBeenCalledWith({
      sessionID: "session-1",
      directory: "D:/repo",
      command: "share",
      arguments: "now",
      agent: "Hephaestus",
      variant: "default",
    });
    expect(mocked.summarizeMock).not.toHaveBeenCalled();
    expect(mocked.promptMock).not.toHaveBeenCalled();
  });
});
