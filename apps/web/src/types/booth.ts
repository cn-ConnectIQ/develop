export type BoothPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  area?: number;
};

export type MapPoiType = "restroom" | "food" | "exit" | "medical";

export type MapPoi = {
  id: string;
  type: MapPoiType;
  x: number;
  y: number;
};

export type MapLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
};

export const POI_EMOJI: Record<MapPoiType, string> = {
  restroom: "🚻",
  food: "🍽️",
  exit: "🚪",
  medical: "🏥",
};

export const POI_TYPES: MapPoiType[] = ["restroom", "food", "exit", "medical"];

export type FormFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "rating";

export type LeadFormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  marketupField?: string;
  sortOrder: number;
};

export type LeadFormConfig = {
  fields: LeadFormField[];
  rules?: Array<{
    id: string;
    sourceFieldId: string;
    sourceValue: string;
    showFieldId: string;
  }>;
  rulesEnabled?: boolean;
};

export type MarketupFieldMap = Record<string, string>;

export type MarketupSyncConfig = {
  writeStrategy: "create_only" | "upsert";
  conflictPolicy: "connectiq" | "marketup";
  triggers: {
    welcomeEmail: boolean;
    assignSalesOnA: boolean;
    nurtureOnEnd: boolean;
  };
};

export const DEFAULT_LEAD_FORM_CONFIG: LeadFormConfig = {
  rulesEnabled: true,
  rules: [
    {
      id: "rule_budget",
      sourceFieldId: "intent",
      sourceValue: "有意向",
      showFieldId: "budget",
    },
  ],
  fields: [
    {
      id: "intent",
      label: "采购意向",
      type: "select",
      required: true,
      options: ["有意向", "了解中", "暂无需求"],
      marketupField: "线索评级",
      sortOrder: 0,
    },
    {
      id: "budget",
      label: "预算范围",
      type: "select",
      required: false,
      options: ["10万以下", "10-50万", "50万以上"],
      marketupField: "采购预算",
      sortOrder: 1,
    },
  ],
};
