import { loadDetail } from "@/modules/reporting/data";
import { buildWorkbook } from "@/modules/reporting/excel";
import { parseSeason, seasonLabel } from "@/modules/reporting/schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = parseSeason(url.searchParams.get("seizoen"), 0);
  if (!requested) return new Response("Ongeldig seizoen", { status: 400 });
  // Dezelfde autorisatie als het dashboard; alle data via de eigen sessie.
  const { client, detail } = await loadDetail(requested);
  const logged = await client.rpc("log_report_export", { season: requested });
  if (logged.error) return new Response(null, { status: 403 });
  const body = await buildWorkbook(detail);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vvpernis-sponsoring-${seasonLabel(requested).replace("/", "-")}.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
