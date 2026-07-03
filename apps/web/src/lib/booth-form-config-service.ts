import { prisma, type Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  buildDefaultFieldMap,
  normalizeLeadFormConfig,
  SYSTEM_CAPTURE_FIELDS,
} from "@/lib/form-config";
import { getExternalSync, parseFieldMap } from "@/lib/external-sync";
import type { FormFieldType, LeadFormConfig, LeadFormField } from "@/types/booth";

const SYSTEM_FIELD_IDS = new Set<string>(
  SYSTEM_CAPTURE_FIELDS.map((f) => f.key),
);

const SYSTEM_FIELD_PREFILL: Record<
  (typeof SYSTEM_CAPTURE_FIELDS)[number]["key"],
  string
> = {
  name: "user.name",
  company: "user.company",
  jobTitle: "user.title",
  phone: "user.phone",
};

type StoredLeadFormField = LeadFormField & { enabled?: boolean };

export type MobileSystemField = {
  id: string;
  label: string;
  type: FormFieldType;
  prefillFrom: string;
  locked: true;
};

export type MobileCustomField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  enabled: boolean;
  order: number;
  options?: string[];
  marketupMapping?: { field: string; label: string };
};

export type MobileFormConfigResponse = {
  boothId: string;
  boothName: string;
  systemFields: MobileSystemField[];
  customFields: MobileCustomField[];
  conditionRules: { enabled: boolean; count: number };
};

const FIELD_TYPES: FormFieldType[] = [
  "text",
  "textarea",
  "select",
  "multiselect",
  "number",
  "rating",
];

function isSystemFieldId(fieldId: string): boolean {
  return SYSTEM_FIELD_IDS.has(fieldId);
}

function assertValidFieldType(type: string): FormFieldType {
  if (!FIELD_TYPES.includes(type as FormFieldType)) {
    throw new ApiError("字段类型无效", ErrorCode.VALIDATION_ERROR, 400);
  }
  return type as FormFieldType;
}

function normalizeOptions(options: unknown): string[] | undefined {
  if (!Array.isArray(options)) return undefined;
  const values = options.map((item) => String(item).trim()).filter(Boolean);
  return values.length ? values : undefined;
}

function resolveMarketupMapping(
  fieldId: string,
  field: StoredLeadFormField,
  fieldMap: Record<string, string>,
): MobileCustomField["marketupMapping"] {
  const mapped = field.marketupField ?? fieldMap[fieldId];
  if (!mapped) return undefined;
  return { field: mapped, label: mapped };
}

function buildSystemFields(): MobileSystemField[] {
  return SYSTEM_CAPTURE_FIELDS.map((field) => ({
    id: field.key,
    label: field.label,
    type: "text" as FormFieldType,
    prefillFrom: SYSTEM_FIELD_PREFILL[field.key],
    locked: true as const,
  }));
}

function toMobileCustomField(
  field: StoredLeadFormField,
  fieldMap: Record<string, string>,
): MobileCustomField {
  return {
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    enabled: field.enabled !== false,
    order: field.sortOrder ?? 0,
    options: field.options,
    marketupMapping: resolveMarketupMapping(field.id, field, fieldMap),
  };
}

function sortCustomFields(fields: StoredLeadFormField[]): StoredLeadFormField[] {
  return [...fields].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
}

async function loadBoothFormContext(boothId: string) {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      name: true,
      eventId: true,
      leadFormConfig: true,
      companyOrg: { select: { name: true } },
    },
  });

  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const config = normalizeLeadFormConfig(booth.leadFormConfig);
  const externalSync = await getExternalSync(booth.eventId);
  const fieldMap = parseFieldMap(externalSync.fieldMap);
  const mergedFieldMap = {
    ...buildDefaultFieldMap(config),
    ...fieldMap,
  };

  return {
    booth,
    config,
    fieldMap: mergedFieldMap,
  };
}

async function persistLeadFormConfig(
  boothId: string,
  config: LeadFormConfig,
): Promise<void> {
  await prisma.exhibitorBooth.update({
    where: { id: boothId },
    data: { leadFormConfig: config as Prisma.InputJsonValue },
  });
}

function toStoredField(
  input: {
    id: string;
    label: string;
    type: FormFieldType;
    required?: boolean;
    enabled?: boolean;
    order?: number;
    options?: string[];
  },
  existing?: StoredLeadFormField,
): StoredLeadFormField {
  return {
    id: input.id,
    label: input.label.trim(),
    type: input.type,
    required: input.required ?? existing?.required ?? false,
    sortOrder: input.order ?? existing?.sortOrder ?? 0,
    options: normalizeOptions(input.options) ?? existing?.options,
    marketupField: existing?.marketupField,
    enabled:
      input.enabled !== undefined
        ? input.enabled
        : existing?.enabled !== undefined
          ? existing.enabled
          : true,
  };
}

export async function getMobileBoothFormConfig(
  boothId: string,
): Promise<MobileFormConfigResponse> {
  const { booth, config, fieldMap } = await loadBoothFormContext(boothId);
  const customFields = sortCustomFields(config.fields as StoredLeadFormField[])
    .filter((field) => !isSystemFieldId(field.id))
    .map((field) => toMobileCustomField(field, fieldMap));

  return {
    boothId: booth.id,
    boothName: booth.name || booth.companyOrg?.name || "",
    systemFields: buildSystemFields(),
    customFields,
    conditionRules: {
      enabled: config.rulesEnabled ?? true,
      count: config.rules?.length ?? 0,
    },
  };
}

export async function patchMobileBoothFormCustomFields(
  boothId: string,
  customFieldsInput: unknown,
): Promise<{ saved: true }> {
  if (!Array.isArray(customFieldsInput)) {
    throw new ApiError("customFields 必须为数组", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { config } = await loadBoothFormContext(boothId);
  const existingById = new Map(
    (config.fields as StoredLeadFormField[]).map((field) => [field.id, field]),
  );

  const nextFields: StoredLeadFormField[] = [];

  for (const [index, raw] of customFieldsInput.entries()) {
    if (!raw || typeof raw !== "object") {
      throw new ApiError("字段格式无效", ErrorCode.VALIDATION_ERROR, 400);
    }

    const row = raw as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const label = String(row.label ?? "").trim();

    if (!id || !label) {
      throw new ApiError("字段 id 与 label 不能为空", ErrorCode.VALIDATION_ERROR, 400);
    }

    if (isSystemFieldId(id)) {
      continue;
    }

    const type = assertValidFieldType(String(row.type ?? "text"));
    const order =
      typeof row.order === "number"
        ? row.order
        : typeof row.sortOrder === "number"
          ? row.sortOrder
          : index;

    nextFields.push(
      toStoredField(
        {
          id,
          label,
          type,
          required: row.required === true,
          enabled: row.enabled !== false,
          order,
          options: normalizeOptions(row.options),
        },
        existingById.get(id),
      ),
    );
  }

  await persistLeadFormConfig(boothId, {
    ...config,
    fields: nextFields,
  });

  return { saved: true };
}

export async function createMobileBoothFormField(
  boothId: string,
  body: unknown,
): Promise<{ field: MobileCustomField }> {
  if (!body || typeof body !== "object") {
    throw new ApiError("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const row = body as Record<string, unknown>;
  const label = String(row.label ?? "").trim();
  if (!label) {
    throw new ApiError("字段名称不能为空", ErrorCode.VALIDATION_ERROR, 400);
  }

  const type = assertValidFieldType(String(row.type ?? "text"));
  const { config, fieldMap } = await loadBoothFormContext(boothId);
  const customFields = (config.fields as StoredLeadFormField[]).filter(
    (field) => !isSystemFieldId(field.id),
  );

  const order =
    typeof row.order === "number"
      ? row.order
      : customFields.length
        ? Math.max(...customFields.map((field) => field.sortOrder ?? 0)) + 1
        : 0;

  const fieldId = `field_${Date.now()}`;
  const created = toStoredField({
    id: fieldId,
    label,
    type,
    required: row.required === true,
    enabled: row.enabled !== false,
    order,
    options: normalizeOptions(row.options),
  });

  await persistLeadFormConfig(boothId, {
    ...config,
    fields: [...customFields, created],
  });

  return { field: toMobileCustomField(created, fieldMap) };
}

export async function updateMobileBoothFormField(
  boothId: string,
  fieldId: string,
  body: unknown,
): Promise<{ field: MobileCustomField }> {
  if (isSystemFieldId(fieldId)) {
    throw new ApiError("系统字段不可修改", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (!body || typeof body !== "object") {
    throw new ApiError("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { config, fieldMap } = await loadBoothFormContext(boothId);
  const fields = config.fields as StoredLeadFormField[];
  const index = fields.findIndex((field) => field.id === fieldId);

  if (index < 0) {
    throw new ApiError("字段不存在", ErrorCode.NOT_FOUND, 404);
  }

  const existing = fields[index]!;
  const row = body as Record<string, unknown>;

  const updated = toStoredField(
    {
      id: fieldId,
      label:
        row.label !== undefined ? String(row.label) : existing.label,
      type:
        row.type !== undefined
          ? assertValidFieldType(String(row.type))
          : existing.type,
      required:
        row.required !== undefined ? row.required === true : existing.required,
      enabled:
        row.enabled !== undefined ? row.enabled !== false : existing.enabled !== false,
      order:
        typeof row.order === "number"
          ? row.order
          : typeof row.sortOrder === "number"
            ? row.sortOrder
            : existing.sortOrder ?? 0,
      options:
        row.options !== undefined
          ? normalizeOptions(row.options)
          : existing.options,
    },
    existing,
  );

  const nextFields = [...fields];
  nextFields[index] = updated;

  await persistLeadFormConfig(boothId, {
    ...config,
    fields: nextFields,
  });

  return { field: toMobileCustomField(updated, fieldMap) };
}

export async function deleteMobileBoothFormField(
  boothId: string,
  fieldId: string,
): Promise<{ deleted: true }> {
  if (isSystemFieldId(fieldId)) {
    throw new ApiError("系统字段不可删除", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { config } = await loadBoothFormContext(boothId);
  const fields = config.fields as StoredLeadFormField[];
  const nextFields = fields.filter((field) => field.id !== fieldId);

  if (nextFields.length === fields.length) {
    throw new ApiError("字段不存在", ErrorCode.NOT_FOUND, 404);
  }

  const nextRules = config.rules?.filter(
    (rule) => rule.sourceFieldId !== fieldId && rule.showFieldId !== fieldId,
  );

  await persistLeadFormConfig(boothId, {
    ...config,
    fields: nextFields,
    rules: nextRules,
  });

  return { deleted: true };
}
