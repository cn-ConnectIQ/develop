"use client";

import type { LeadFormField } from "@/lib/lead-form/types";
import { LeadFormRenderer } from "./LeadFormRenderer";

type LeadFormPreviewProps = {
  fields: LeadFormField[];
  title?: string;
};

export function LeadFormPreview({ fields, title }: LeadFormPreviewProps) {
  return (
    <div className="sticky top-6">
      <h3 className="mb-4 text-sm font-semibold">手机端预览</h3>
      <div className="mx-auto w-[375px] overflow-hidden rounded-3xl border-8 border-gray-800 bg-white shadow-xl">
        <div className="bg-gray-800 px-4 py-2 text-center">
          <div className="mx-auto h-1 w-16 rounded-full bg-gray-600" />
        </div>
        <div className="max-h-[640px] overflow-y-auto p-5">
          <LeadFormRenderer
            fields={fields}
            title={title ?? "抽奖留资"}
            subtitle="参会者扫码后看到的表单"
            submitLabel="提交并参与抽奖"
            user={{
              name: "张三",
              phone: "138****8888",
              company: "示例科技有限公司",
              title: "采购经理",
            }}
            onSubmit={() => undefined}
          />
        </div>
      </div>
    </div>
  );
}
