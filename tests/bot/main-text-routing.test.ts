import { describe, expect, it, vi } from "vitest";
import type { Bot, Context } from "grammy";
import { handleMainTextRouting } from "../../src/bot/index.js";

function createTextContext(text: string): Context {
  return {
    chat: { id: 101 },
    message: { text } as Context["message"],
  } as unknown as Context;
}

describe("bot/main-text-routing", () => {
  it("forwards exact slash-leading text to processUserPrompt when passthrough is consumed", async () => {
    const ctx = createTextContext("/start-work my-plan");
    const processPromptFn = vi.fn().mockResolvedValue(undefined);

    await handleMainTextRouting(ctx, {
      bot: {} as Bot<Context>,
      consumePassthroughFn: () => "payload",
      processPromptFn,
      isQuestionActiveFn: () => false,
      handleRenameTextAnswerFn: vi.fn().mockResolvedValue(false),
      handleQuestionTextAnswerFn: vi.fn().mockResolvedValue(undefined),
      ensureEventSubscriptionFn: vi.fn().mockResolvedValue(undefined),
    });

    expect(processPromptFn).toHaveBeenCalledTimes(1);
    expect(processPromptFn).toHaveBeenCalledWith(
      ctx,
      "/start-work my-plan",
      expect.objectContaining({
        bot: expect.any(Object),
        ensureEventSubscription: expect.any(Function),
      }),
    );
  });

  it("treats consume as one-shot: second text without re-arm follows normal slash routing", async () => {
    const processPromptFn = vi.fn().mockResolvedValue(undefined);
    const consumePassthroughFn = vi
      .fn<() => string | null>()
      .mockReturnValueOnce("payload")
      .mockReturnValueOnce(null);

    await handleMainTextRouting(createTextContext("/start-work my-plan"), {
      bot: {} as Bot<Context>,
      consumePassthroughFn,
      processPromptFn,
      isQuestionActiveFn: () => false,
      handleRenameTextAnswerFn: vi.fn().mockResolvedValue(false),
      handleQuestionTextAnswerFn: vi.fn().mockResolvedValue(undefined),
      ensureEventSubscriptionFn: vi.fn().mockResolvedValue(undefined),
    });

    await handleMainTextRouting(createTextContext("/status"), {
      bot: {} as Bot<Context>,
      consumePassthroughFn,
      processPromptFn,
      isQuestionActiveFn: () => false,
      handleRenameTextAnswerFn: vi.fn().mockResolvedValue(false),
      handleQuestionTextAnswerFn: vi.fn().mockResolvedValue(undefined),
      ensureEventSubscriptionFn: vi.fn().mockResolvedValue(undefined),
    });

    expect(consumePassthroughFn).toHaveBeenCalledTimes(2);
    expect(processPromptFn).toHaveBeenCalledTimes(1);
    expect(processPromptFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ text: "/start-work my-plan" }),
      }),
      "/start-work my-plan",
      expect.any(Object),
    );
  });

  it("keeps unarmed flow unchanged for regular text", async () => {
    const ctx = createTextContext("regular prompt");
    const processPromptFn = vi.fn().mockResolvedValue(undefined);
    const handleRenameTextAnswerFn = vi.fn().mockResolvedValue(false);
    const handleQuestionTextAnswerFn = vi.fn().mockResolvedValue(undefined);

    await handleMainTextRouting(ctx, {
      bot: {} as Bot<Context>,
      consumePassthroughFn: () => null,
      processPromptFn,
      isQuestionActiveFn: () => false,
      handleRenameTextAnswerFn,
      handleQuestionTextAnswerFn,
      ensureEventSubscriptionFn: vi.fn().mockResolvedValue(undefined),
    });

    expect(handleQuestionTextAnswerFn).not.toHaveBeenCalled();
    expect(handleRenameTextAnswerFn).toHaveBeenCalledTimes(1);
    expect(processPromptFn).toHaveBeenCalledTimes(1);
    expect(processPromptFn).toHaveBeenCalledWith(
      ctx,
      "regular prompt",
      expect.objectContaining({
        bot: expect.any(Object),
        ensureEventSubscription: expect.any(Function),
      }),
    );
  });

  it("keeps unarmed flow unchanged for slash text by skipping forwarding", async () => {
    const processPromptFn = vi.fn().mockResolvedValue(undefined);
    const handleRenameTextAnswerFn = vi.fn().mockResolvedValue(false);
    const handleQuestionTextAnswerFn = vi.fn().mockResolvedValue(undefined);

    await handleMainTextRouting(createTextContext("/status"), {
      bot: {} as Bot<Context>,
      consumePassthroughFn: () => null,
      processPromptFn,
      isQuestionActiveFn: () => false,
      handleRenameTextAnswerFn,
      handleQuestionTextAnswerFn,
      ensureEventSubscriptionFn: vi.fn().mockResolvedValue(undefined),
    });

    expect(handleQuestionTextAnswerFn).not.toHaveBeenCalled();
    expect(handleRenameTextAnswerFn).not.toHaveBeenCalled();
    expect(processPromptFn).not.toHaveBeenCalled();
  });

  it("does not consume or forward passthrough when interaction becomes active before routing", async () => {
    const processPromptFn = vi.fn().mockResolvedValue(undefined);
    const consumePassthroughFn = vi.fn<() => string | null>().mockReturnValueOnce("payload");
    const isInteractionActiveFn = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    await handleMainTextRouting(createTextContext("/start-work my-plan"), {
      bot: {} as Bot<Context>,
      consumePassthroughFn,
      isInteractionActiveFn,
      processPromptFn,
      isQuestionActiveFn: () => false,
      handleRenameTextAnswerFn: vi.fn().mockResolvedValue(false),
      handleQuestionTextAnswerFn: vi.fn().mockResolvedValue(undefined),
      ensureEventSubscriptionFn: vi.fn().mockResolvedValue(undefined),
    });

    expect(consumePassthroughFn).not.toHaveBeenCalled();
    expect(processPromptFn).not.toHaveBeenCalled();

    await handleMainTextRouting(createTextContext("/start-work my-plan"), {
      bot: {} as Bot<Context>,
      consumePassthroughFn,
      isInteractionActiveFn,
      processPromptFn,
      isQuestionActiveFn: () => false,
      handleRenameTextAnswerFn: vi.fn().mockResolvedValue(false),
      handleQuestionTextAnswerFn: vi.fn().mockResolvedValue(undefined),
      ensureEventSubscriptionFn: vi.fn().mockResolvedValue(undefined),
    });

    expect(isInteractionActiveFn).toHaveBeenCalledTimes(2);
    expect(consumePassthroughFn).toHaveBeenCalledTimes(1);
    expect(processPromptFn).toHaveBeenCalledTimes(1);
    expect(processPromptFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ text: "/start-work my-plan" }),
      }),
      "/start-work my-plan",
      expect.any(Object),
    );
  });
});
