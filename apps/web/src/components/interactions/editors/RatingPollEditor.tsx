"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RatingEditor } from "@/components/interactions/editors/RatingEditor";
import {
  useInteractionAutoSave,
  patchPoll,
} from "@/hooks/useInteractionAutoSave";
import {
  buildRatingPollOptions,
  isRatingConfigOption,
  parseRatingConfigFromOptions,
  type RatingPollConfig,
} from "@/lib/rating-poll-config";

type RatingPollEditorProps = {
  eventId: string;
  pollId: string;
  options: Array<{ id: string; text: string }>;
  onChange?: (options: Array<{ id: string; text: string }>) => void;
};

export function RatingPollEditor({
  eventId,
  pollId,
  options,
  onChange,
}: RatingPollEditorProps) {
  const [config, setConfig] = useState(() =>
    parseRatingConfigFromOptions(options),
  );
  const loadedPollIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (loadedPollIdRef.current === pollId) return;
    loadedPollIdRef.current = pollId;
    setConfig(parseRatingConfigFromOptions(optionsRef.current));
  }, [pollId]);

  const { scheduleSave } = useInteractionAutoSave<
    Array<{ id?: string; text: string }>
  >({
    debounceMs: 600,
    onSave: async (payload) => {
      await patchPoll(eventId, pollId, { options: payload });
    },
  });

  useEffect(() => {
    if (options.some((o) => isRatingConfigOption(o.text))) return;
    const defaults = parseRatingConfigFromOptions(options);
    const nextOptions = buildRatingPollOptions(options, defaults);
    scheduleSave(
      nextOptions.map((o) => ({
        id: o.id?.startsWith("new-") ? undefined : o.id,
        text: o.text,
      })),
    );
  }, [pollId, options, scheduleSave]);

  const persist = useCallback(
    (next: RatingPollConfig) => {
      setConfig(next);
      const nextOptions = buildRatingPollOptions(optionsRef.current, next);
      onChange?.(
        nextOptions.map((o) => ({
          id: o.id ?? `rating-config-${pollId}`,
          text: o.text,
        })),
      );
      scheduleSave(
        nextOptions.map((o) => ({
          id: o.id?.startsWith("new-") ? undefined : o.id,
          text: o.text,
        })),
      );
    },
    [onChange, scheduleSave],
  );

  return (
    <RatingEditor
      minScore={config.minScore}
      maxScore={config.maxScore}
      lowLabel={config.lowLabel}
      highLabel={config.highLabel}
      onChange={persist}
    />
  );
}
