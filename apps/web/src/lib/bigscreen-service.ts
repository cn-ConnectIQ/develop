import { prisma, type Prisma } from "@connectiq/database";
import {
  DEFAULT_DISPLAY_CONFIG,
  displaySettingKey,
  parseDisplayConfig,
  type BigscreenDisplayConfig,
} from "@/lib/bigscreen-display";

export async function getPollDisplayConfig(
  eventId: string,
  pollId: string,
  showResultsFallback = true,
): Promise<BigscreenDisplayConfig> {
  const setting = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: displaySettingKey(pollId) } },
  });

  if (setting?.value) {
    return parseDisplayConfig(setting.value);
  }

  return { ...DEFAULT_DISPLAY_CONFIG, showResults: showResultsFallback };
}

export async function updatePollDisplayConfig(
  eventId: string,
  pollId: string,
  patch: Partial<BigscreenDisplayConfig>,
): Promise<BigscreenDisplayConfig> {
  const current = await getPollDisplayConfig(eventId, pollId);
  const next: BigscreenDisplayConfig = {
    ...current,
    ...patch,
    hiddenResponseIds: patch.hiddenResponseIds ?? current.hiddenResponseIds,
    pinnedResponseIds: patch.pinnedResponseIds ?? current.pinnedResponseIds,
    answeredResponseIds:
      patch.answeredResponseIds ?? current.answeredResponseIds,
  };

  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: displaySettingKey(pollId) } },
    create: {
      eventId,
      key: displaySettingKey(pollId),
      value: next as Prisma.InputJsonValue,
    },
    update: { value: next as Prisma.InputJsonValue },
  });

  if (patch.showResults !== undefined) {
    await prisma.poll.update({
      where: { id: pollId },
      data: { showResults: patch.showResults },
    });
  }

  return next;
}
