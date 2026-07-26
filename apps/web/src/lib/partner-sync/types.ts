import type { DataSource } from "@connectiq/database";

/** 拉取归一化后的一条报名记录，externalId 缺失时仍可按手机号匹配，但不会写入 ParticipantRegistration 外部映射 */
export type PartnerRegistrationRow = {
  externalId?: string | null;
  externalStatus?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  jobTitle?: string | null;
};

/**
 * 每个伙伴渠道（百格、未来的其他渠道）实现一份 adapter，
 * 通用的编排/落库逻辑（并发锁、运行记录、Participant 落库）都在 orchestrator 里，不需要重复实现。
 */
export interface PartnerParticipantAdapter {
  provider: string;
  /** 该渠道同步后应写入 Event.dataSource 的值 */
  dataSource: DataSource;
  /** 解析该组织可用的访问凭证；优先读取该组织的 PartnerConnection，其次可回退到渠道自身的静态配置 */
  resolveAuth(orgId: string): Promise<{ token: string } | null>;
  /** 拉取某个外部活动的原始报名列表 */
  fetchRegistrations(
    externalEventId: string,
    auth: { token: string } | null,
  ): Promise<unknown[]>;
  /** 把一条原始报名记录映射为通用行；无法识别姓名/手机号时返回 null（跳过） */
  mapRegistration(raw: unknown): PartnerRegistrationRow | null;
}
