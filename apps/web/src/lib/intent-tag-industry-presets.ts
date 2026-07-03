export type IndustryPresetKey =
  | "tech"
  | "manufacturing"
  | "finance"
  | "healthcare"
  | "consumer";

export type IndustryIntentPreset = {
  key: IndustryPresetKey;
  label: string;
  supply: string[];
  demand: string[];
  topics: string[];
};

export const INDUSTRY_INTENT_PRESETS: IndustryIntentPreset[] = [
  {
    key: "tech",
    label: "科技",
    supply: [
      "AI 解决方案",
      "数据安全",
      "云计算",
      "SaaS 产品",
      "DevOps 工具",
      "大模型应用",
    ],
    demand: [
      "AI 落地场景",
      "企业数字化",
      "数据中台",
      "安全合规",
      "渠道合作",
      "技术集成",
    ],
    topics: ["AI 落地", "出海增长", "PLG", "开源生态", "开发者工具"],
  },
  {
    key: "manufacturing",
    label: "制造",
    supply: [
      "工业互联网",
      "智能制造",
      "供应链协同",
      "设备物联网",
      "MES 系统",
      "质检自动化",
    ],
    demand: [
      "产线数字化",
      "柔性制造",
      "供应链优化",
      "节能降本",
      "海外产能",
      "核心零部件",
    ],
    topics: ["智能制造", "双碳", "供应链韧性", "专精特新", "工业软件"],
  },
  {
    key: "finance",
    label: "金融",
    supply: [
      "供应链金融",
      "风控模型",
      "支付清算",
      "财富科技",
      "RegTech",
      "保险科技",
    ],
    demand: [
      "资产标的",
      "合规方案",
      "零售银行数字化",
      "跨境支付",
      "数据治理",
      "场景金融",
    ],
    topics: ["金融科技", "ESG 投资", "数字人民币", "开放银行", "反欺诈"],
  },
  {
    key: "healthcare",
    label: "医疗",
    supply: [
      "医疗 AI",
      "院内信息化",
      "器械渠道",
      "临床试验 CRO",
      "健康管理",
      "医学影像",
    ],
    demand: [
      "医院合作",
      "医保合规",
      "创新药 BD",
      "数字化诊疗",
      "基层医疗",
      "跨境注册",
    ],
    topics: ["创新药", "医疗出海", "DRG/DIP", "智慧医院", "康养产业"],
  },
  {
    key: "consumer",
    label: "消费",
    supply: [
      "品牌联名",
      "新零售系统",
      "私域运营",
      "直播电商",
      "会员体系",
      "供应链柔性",
    ],
    demand: [
      "渠道拓展",
      "爆品共创",
      "达人合作",
      "下沉市场",
      "出海品牌",
      "即时零售",
    ],
    topics: ["新消费", "国潮品牌", "DTC", "即时零售", "用户增长"],
  },
];

export function getIndustryPreset(key: IndustryPresetKey): IndustryIntentPreset | undefined {
  return INDUSTRY_INTENT_PRESETS.find((p) => p.key === key);
}

export function mergeTagLists(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    for (const raw of group) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(label);
    }
  }
  return result;
}
