import type { ScanActionType, ScanResult } from "@connectiq/database";

export type ScanParticipantView = {
  name: string;
  company: string | null;
  avatar: string;
  tags: string[];
};

export type ScanHandlerContext = {
  eventId: string;
  codeId: string;
  attendeeUserId: string;
  operatorId: string;
  actionRef?: string;
  participant: ScanParticipantView;
};

export type ScanHandlerOutcome = {
  result: ScanResult;
  message: string;
  actionDetail?: unknown;
};

export type ScanExecuteResult = {
  result: ScanResult;
  message: string;
  participant: ScanParticipantView | null;
  actionDetail?: unknown;
};

export type ScanExecuteInput = {
  eventId: string;
  rawCode: string;
  action: ScanActionType;
  actionRef?: string;
  operatorId: string;
};
