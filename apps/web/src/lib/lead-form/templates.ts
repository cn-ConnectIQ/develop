import type { LeadFormField, LeadFormFieldType, LeadFormPrefillSource } from "./types";

export type LeadFormFieldPreset = {
  key: string;
  label: string;
  description: string;
  type: LeadFormFieldType;
  prefill_from?: LeadFormPrefillSource;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

export const LEAD_FORM_FIELD_PRESETS: LeadFormFieldPreset[] = [
  {
    key: "name",
    label: "姓名",
    description: "单行文本，可自动带入用户姓名",
    type: "text",
    prefill_from: "user.name",
    required: true,
    placeholder: "请输入姓名",
  },
  {
    key: "phone",
    label: "手机",
    description: "手机号，可自动带入",
    type: "phone",
    prefill_from: "user.phone",
    required: true,
    placeholder: "请输入手机号",
  },
  {
    key: "email",
    label: "邮件",
    description: "邮箱地址",
    type: "email",
    required: false,
    placeholder: "请输入邮箱",
  },
  {
    key: "company",
    label: "公司",
    description: "公司名称，可自动带入",
    type: "text",
    prefill_from: "user.company",
    required: false,
    placeholder: "请输入公司",
  },
  {
    key: "title",
    label: "职位",
    description: "职位头衔，可自动带入",
    type: "text",
    prefill_from: "user.title",
    required: false,
    placeholder: "请输入职位",
  },
  {
    key: "need",
    label: "采购需求",
    description: "多行文本，了解访客需求",
    type: "textarea",
    required: false,
    placeholder: "请描述您的采购需求",
  },
  {
    key: "intent",
    label: "采购意向",
    description: "单选题，便于 AI 评级",
    type: "select",
    required: true,
    options: ["有意向", "了解中", "暂无需求"],
  },
  {
    key: "custom",
    label: "自定义",
    description: "空白自定义字段",
    type: "text",
    required: false,
    placeholder: "请输入",
  },
];

export function createFieldFromPreset(
  preset: LeadFormFieldPreset,
  sortOrder: number,
): LeadFormField {
  return {
    id: `${preset.key}_${Date.now()}`,
    type: preset.type,
    label: preset.label,
    placeholder: preset.placeholder,
    required: preset.required ?? false,
    options: preset.options,
    prefill_from: preset.prefill_from,
    sortOrder,
  };
}
