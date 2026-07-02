export type LeadFormFieldType =
  | "text"
  | "phone"
  | "email"
  | "select"
  | "multiselect"
  | "textarea";

export type LeadFormPrefillSource =
  | "user.name"
  | "user.phone"
  | "user.company"
  | "user.title";

export type LeadFormField = {
  id: string;
  type: LeadFormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  prefill_from?: LeadFormPrefillSource;
  sortOrder?: number;
};

/** 存入 Lottery.lead_form_config 的结构（兼容纯数组） */
export type LeadFormConfig = {
  fields: LeadFormField[];
};

export type LeadFormEntry = {
  field_id: string;
  value: string;
};

export type LeadFormSubmitBody = {
  lottery_id: string;
  entries: LeadFormEntry[];
};

export type LeadFormSubmitResult = {
  entry_id: string;
  lead_id: string;
  ai_intent_level: "A" | "B" | "C";
};

export type LeadFormUserPrefill = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  title?: string | null;
};
