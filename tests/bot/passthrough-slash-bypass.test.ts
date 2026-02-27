import { describe, expect, it, vi } from "vitest";
import type { Bot, Context } from "grammy";
import { handlePassthroughSlashBypass } from "../../src/bot/index.js";

function createTextContext(text: string): Context {
  return {
    chat: { id: 101 },
    message: { text } as Context["message"],
  } as unknown as Context;
}

describe("bot/passthrough-slash-bypass", () => {
  it("bypasses command handling and routes armed slash via main text routing", async () => {
    const ctx = createTextContext("/status");
    const handleMainTextRoutingFn = vi.fn().mockResolvedValue(undefined);

    const handled = await handlePassthroughSlashBypass(ctx, {
      bot: {} as Bot<Context>,
      isPassthroughArmedFn: () => true,
      handleMainTextRoutingFn,
    });

    expect(handled).toBe(true);
    expect(handleMainTextRoutingFn).toHaveBeenCalledTimes(1);
    expect(handleMainTextRoutingFn).toHaveBeenCalledWith(ctx, {
      bot: expect.any(Object),
    });
  });

  it("does not bypass when message is /passthrough itself", async () => {
    const ctx = createTextContext("/passthrough");
    const handleMainTextRoutingFn = vi.fn().mockResolvedValue(undefined);

    const handled = await handlePassthroughSlashBypass(ctx, {
      bot: {} as Bot<Context>,
      isPassthroughArmedFn: () => true,
      handleMainTextRoutingFn,
    });

    expect(handled).toBe(false);
    expect(handleMainTextRoutingFn).not.toHaveBeenCalled();
  });

  it("does not bypass when passthrough is not armed", async () => {
    const ctx = createTextContext("/status");
    const handleMainTextRoutingFn = vi.fn().mockResolvedValue(undefined);

    const handled = await handlePassthroughSlashBypass(ctx, {
      bot: {} as Bot<Context>,
      isPassthroughArmedFn: () => false,
      handleMainTextRoutingFn,
    });

    expect(handled).toBe(false);
    expect(handleMainTextRoutingFn).not.toHaveBeenCalled();
  });
});
