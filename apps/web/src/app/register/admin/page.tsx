import { Suspense } from "react";
import { AdminRegisterForm } from "@/components/register/admin-register-form";

export default function AdminRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-text-muted">
          加载中...
        </div>
      }
    >
      <AdminRegisterForm />
    </Suspense>
  );
}
