import type { PartnerParticipantAdapter } from "@/lib/partner-sync/types";
import { baigeParticipantAdapter } from "@/lib/integrations/baige-participant-adapter";

/** provider -> adapter。新增伙伴渠道时只需在这里登记一行，不需要改动 orchestrator。 */
const ADAPTERS: PartnerParticipantAdapter[] = [baigeParticipantAdapter];

const registry = new Map<string, PartnerParticipantAdapter>(
  ADAPTERS.map((adapter) => [adapter.provider, adapter]),
);

export function getPartnerParticipantAdapter(
  provider: string,
): PartnerParticipantAdapter | null {
  return registry.get(provider) ?? null;
}

export function listPartnerParticipantProviders(): string[] {
  return Array.from(registry.keys());
}
