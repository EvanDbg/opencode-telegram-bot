import { Context } from "grammy";
import { createMainKeyboard } from "../utils/keyboard.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getStoredModel } from "../../model/manager.js";
import { formatVariantForButton } from "../../variant/manager.js";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { keyboardManager } from "../../keyboard/manager.js";
import { t } from "../../i18n/index.js";
import { getScopeFromContext } from "../scope.js";

export async function startCommand(ctx: Context): Promise<void> {
  const scope = getScopeFromContext(ctx);
  const scopeKey = scope?.key ?? "global";
  const allowPinned = scope?.threadId === null;

  if (ctx.chat) {
    if (allowPinned && !pinnedMessageManager.isInitialized()) {
      pinnedMessageManager.initialize(ctx.api, ctx.chat.id);
    }
    keyboardManager.initialize(ctx.api, ctx.chat.id, scopeKey);
  }

  if (pinnedMessageManager.getContextLimit() === 0) {
    await pinnedMessageManager.refreshContextLimit();
  }

  // Get current agent, model, and context
  const currentAgent = getStoredAgent();
  const currentModel = getStoredModel();
  const variantName = formatVariantForButton(currentModel.variant || "default");
  const contextInfo =
    keyboardManager.getContextInfo(scopeKey) ??
    (allowPinned ? pinnedMessageManager.getContextInfo() : null) ??
    (pinnedMessageManager.getContextLimit() > 0
      ? { tokensUsed: 0, tokensLimit: pinnedMessageManager.getContextLimit() }
      : null);

  keyboardManager.updateAgent(currentAgent, scopeKey);
  keyboardManager.updateModel(currentModel, scopeKey);
  if (contextInfo) {
    keyboardManager.updateContext(contextInfo.tokensUsed, contextInfo.tokensLimit, scopeKey);
  }

  const keyboard = createMainKeyboard(
    currentAgent,
    currentModel,
    contextInfo ?? undefined,
    variantName,
  );

  await ctx.reply(t("start.welcome"), { reply_markup: keyboard });
}
