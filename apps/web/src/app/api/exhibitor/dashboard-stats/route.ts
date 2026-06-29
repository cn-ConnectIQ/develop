import QRCode from "qrcode";
import {
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getExhibitorDashboardStats } from "@/lib/exhibitor/dashboard-service";
import { requireExhibitorAdmin } from "@/lib/exhibitor/exhibitor-auth";

export const GET = withErrorHandler(async (request) => {
  const { booth } = await requireExhibitorAdmin(request);
  const stats = await getExhibitorDashboardStats(booth.id, booth.eventId);
  const qrDataUrl = await QRCode.toDataURL(booth.scanUrl, {
    width: 200,
    margin: 2,
    errorCorrectionLevel: "H",
  });

  return createSuccessResponse({
    booth: {
      id: booth.id,
      code: booth.code,
      name: booth.name,
      org_name: booth.orgName,
      event_id: booth.eventId,
      event_name: booth.eventName,
      scan_url: booth.scanUrl,
      qr_data_url: qrDataUrl,
    },
    ...stats,
  });
});
