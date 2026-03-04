import type { Context } from "grammy";

const GLOBAL_SCOPE_KEY = "global";

export interface ConversationScope {
  key: string;
  chatId: number;
  threadId: number | null;
}

export function createScopeKey(chatId: number, threadId: number | null): string {
  return threadId === null ? GLOBAL_SCOPE_KEY : `${chatId}:${threadId}`;
}

function extractThreadIdFromMessage(message: {
  is_topic_message?: boolean;
  message_thread_id?: number;
}): number | null {
  if (typeof message.message_thread_id === "number") {
    return message.message_thread_id;
  }

  return message.is_topic_message ? null : null;
}

export function getScopeFromContext(ctx: Context): ConversationScope | null {
  if (!ctx.chat) {
    return null;
  }

  const threadId = ctx.message
    ? extractThreadIdFromMessage(ctx.message)
    : ctx.callbackQuery && "message" in ctx.callbackQuery && ctx.callbackQuery.message
      ? extractThreadIdFromMessage(ctx.callbackQuery.message as { message_thread_id?: number })
      : null;

  return {
    key: createScopeKey(ctx.chat.id, threadId),
    chatId: ctx.chat.id,
    threadId,
  };
}

export function getScopeKeyFromContext(ctx: Context): string {
  return getScopeFromContext(ctx)?.key ?? GLOBAL_SCOPE_KEY;
}

export function getThreadSendOptions(threadId: number | null): { message_thread_id?: number } {
  if (threadId === null) {
    return {};
  }

  return { message_thread_id: threadId };
}
