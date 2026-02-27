import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { passthroughCommand } from "../../../src/bot/commands/passthrough.js";
import { interactionManager } from "../../../src/interaction/manager.js";
import { passthroughManager } from "../../../src/passthrough/manager.js";
import { t } from "../../../src/i18n/index.js";

function createContext(): Context {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context;
}

describe("bot/commands/passthrough", () => {
  beforeEach(() => {
    interactionManager.clear("test_setup");
    passthroughManager.clear();
  });

  it("arms one-shot passthrough when interaction is idle", async () => {
    const ctx = createContext();

    await passthroughCommand(ctx as never);

    expect(passthroughManager.isArmed()).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(t("passthrough.armed"));
  });

  it("blocks arming when another interaction is active", async () => {
    interactionManager.start({
      kind: "rename",
      expectedInput: "text",
      metadata: { sessionId: "session-1" },
    });

    const ctx = createContext();
    await passthroughCommand(ctx as never);

    expect(passthroughManager.isArmed()).toBe(false);
    expect(ctx.reply).toHaveBeenCalledWith(t("passthrough.blocked.interaction_active"));
  });

  it("does not clear already armed passthrough when blocked by active interaction", async () => {
    passthroughManager.arm("armed-before-block");
    interactionManager.start({
      kind: "rename",
      expectedInput: "text",
      metadata: { sessionId: "session-1" },
    });

    const ctx = createContext();
    await passthroughCommand(ctx as never);

    expect(passthroughManager.isArmed()).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(t("passthrough.blocked.interaction_active"));
  });
});
