import type { LeadAiSummary, ParsedLeadNote } from "@/lib/ai/lead-note-parser";
import {
  formatStructuredNote,
  toLeadAiSummary,
  tryParseLeadNote,
} from "@/lib/ai/lead-note-parser";

export type LeadNotesInput = {
  form_data?: Record<string, unknown>;
  voice_note_url?: string;
  text_note?: string;
  structured_note?: string;
  notes?: string;
};

export type StoredLeadNotes = {
  note: string | null;
  text_note: string | null;
  structured_note: string | null;
  voice_url: string | null;
  ai_summary: LeadAiSummary | null;
  structured_fields: ParsedLeadNote | null;
};

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readAiSummary(raw: unknown): LeadAiSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const requirement = readString(row.requirement) ?? readString(row.需求);
  const budget = readString(row.budget) ?? readString(row.预算);
  const next_step =
    readString(row.next_step) ??
    readString(row.nextStep) ??
    readString(row.下一步);

  if (!requirement && !budget && !next_step) return null;

  return {
    requirement: requirement ?? "",
    budget: budget ?? "",
    next_step: next_step ?? "",
  };
}

function readStructuredFields(raw: unknown): ParsedLeadNote | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const parsed: ParsedLeadNote = {
    需求: readString(row.需求) ?? readString(row.requirement) ?? "",
    预算: readString(row.预算) ?? readString(row.budget) ?? "",
    下一步:
      readString(row.下一步) ??
      readString(row.next_step) ??
      readString(row.nextStep) ??
      "",
  };

  if (!parsed.需求 && !parsed.预算 && !parsed.下一步) return null;
  return parsed;
}

export function parseStoredLeadNotes(notes: string | null): StoredLeadNotes {
  if (!notes?.trim()) {
    return {
      note: null,
      text_note: null,
      structured_note: null,
      voice_url: null,
      ai_summary: null,
      structured_fields: null,
    };
  }

  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      const voice_url =
        readString(parsed.voice_note_url) ?? readString(parsed.voice_url);
      const text_note = readString(parsed.text_note);
      const structured_note = readString(parsed.structured_note);
      const note =
        text_note ??
        readString(parsed.note) ??
        structured_note;

      return {
        note,
        text_note,
        structured_note,
        voice_url,
        ai_summary:
          readAiSummary(parsed.ai_summary) ??
          readAiSummary(parsed.aiSummary) ??
          readAiSummary(parsed.structured_fields),
        structured_fields:
          readStructuredFields(parsed.structured_fields) ??
          readStructuredFields(parsed.ai_summary),
      };
    }
  } catch {
    // plain text notes
  }

  const voiceMatch = notes.match(/\/uploads\/voice\/[^\s"'<>]+/);
  return {
    note: notes,
    text_note: null,
    structured_note: null,
    voice_url: voiceMatch?.[0] ?? null,
    ai_summary: null,
    structured_fields: null,
  };
}

export async function buildLeadNotesPayload(
  input: LeadNotesInput,
): Promise<string | null> {
  const payload: Record<string, unknown> = {};

  if (input.form_data && Object.keys(input.form_data).length > 0) {
    payload.form_data = input.form_data;
  }
  if (input.voice_note_url) payload.voice_note_url = input.voice_note_url;

  const textNote = input.text_note?.trim();
  if (textNote) payload.text_note = textNote;

  const manualStructuredNote = input.structured_note?.trim();
  if (manualStructuredNote) {
    payload.structured_note = manualStructuredNote;
  }

  if (input.notes?.trim()) payload.note = input.notes.trim();

  if (textNote) {
    const parsed = await tryParseLeadNote(textNote);
    if (parsed) {
      payload.ai_summary = toLeadAiSummary(parsed);
      payload.structured_fields = parsed;
      if (!manualStructuredNote) {
        payload.structured_note = formatStructuredNote(parsed);
      }
    }
  }

  if (Object.keys(payload).length === 0) return null;
  return JSON.stringify(payload);
}
