import { Suspense } from "react";
import { BaigeIntegrationClient } from "@/components/integrations/BaigeIntegrationClient";

export default function BaigeIntegrationPage() {
  return (
    <Suspense fallback={null}>
      <BaigeIntegrationClient />
    </Suspense>
  );
}
