import { CommandContext, Context } from "grammy";
import { interactionManager } from "../../interaction/manager.js";
import { passthroughManager } from "../../passthrough/manager.js";
import { t } from "../../i18n/index.js";
import { logger } from "../../utils/logger.js";

export async function passthroughCommand(ctx: CommandContext<Context>): Promise<void> {
  const activeInteraction = interactionManager.getSnapshot();
  if (activeInteraction) {
    logger.debug(
      `[PassthroughCommand] Blocked while interaction active: kind=${activeInteraction.kind}, expectedInput=${activeInteraction.expectedInput}`,
    );
    await ctx.reply(t("passthrough.blocked.interaction_active"));
    return;
  }

  passthroughManager.arm("passthrough");
  logger.info("[PassthroughCommand] One-shot passthrough mode armed");
  await ctx.reply(t("passthrough.armed"));
}
