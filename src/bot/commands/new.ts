import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { setCurrentSession, SessionInfo } from "../../session/manager.js";
import { ingestSessionInfoForCache } from "../../session/cache-manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { clearAllInteractionState } from "../../interaction/cleanup.js";
import { summaryAggregator } from "../../summary/aggregator.js";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { keyboardManager } from "../../keyboard/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getStoredModel } from "../../model/manager.js";
import { formatVariantForButton } from "../../variant/manager.js";
import { createMainKeyboard } from "../utils/keyboard.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { getScopeFromContext } from "../scope.js";

export async function newCommand(ctx: CommandContext<Context>) {
  try {
    const scope = getScopeFromContext(ctx);
    const scopeKey = scope?.key ?? "global";
    const allowPinned = scope?.threadId === null;

    const currentProject = getCurrentProject();

    if (!currentProject) {
      await ctx.reply(t("new.project_not_selected"));
      return;
    }

    logger.debug("[Bot] Creating new session for directory:", currentProject.worktree);

    const { data: session, error } = await opencodeClient.session.create({
      directory: currentProject.worktree,
    });

    if (error || !session) {
      throw error || new Error("No data received from server");
    }

    logger.info(
      `[Bot] Created new session via /new command: id=${session.id}, title="${session.title}", project=${currentProject.worktree}`,
    );

    const sessionInfo: SessionInfo = {
      id: session.id,
      title: session.title,
      directory: currentProject.worktree,
    };
    setCurrentSession(sessionInfo, scopeKey);
    summaryAggregator.setSession(session.id);
    clearAllInteractionState("session_created", scopeKey);
    await ingestSessionInfoForCache(session);

    // Initialize pinned message manager and create pinned message
    if (allowPinned && !pinnedMessageManager.isInitialized()) {
      pinnedMessageManager.initialize(ctx.api, ctx.chat.id);
    }

    // Initialize keyboard manager if not already
    keyboardManager.initialize(ctx.api, ctx.chat.id, scopeKey);

    if (allowPinned) {
      try {
        await pinnedMessageManager.onSessionChange(session.id, session.title);
      } catch (err) {
        logger.error("[Bot] Error creating pinned message:", err);
      }
    }

    if (pinnedMessageManager.getContextLimit() === 0) {
      await pinnedMessageManager.refreshContextLimit();
    }

    // Get current state for keyboard
    const currentAgent = getStoredAgent();
    const currentModel = getStoredModel();
    const contextInfo =
      (allowPinned ? pinnedMessageManager.getContextInfo() : null) ??
      keyboardManager.getContextInfo(scopeKey) ??
      (pinnedMessageManager.getContextLimit() > 0
        ? { tokensUsed: 0, tokensLimit: pinnedMessageManager.getContextLimit() }
        : null);
    const variantName = formatVariantForButton(currentModel.variant || "default");
    const keyboard = createMainKeyboard(
      currentAgent,
      currentModel,
      contextInfo ?? undefined,
      variantName,
    );

    await ctx.reply(t("new.created", { title: session.title }), {
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("[Bot] Error creating session:", error);
    await ctx.reply(t("new.create_error"));
  }
}
