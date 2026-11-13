import "server-only";
import { requireReporting } from "./access";
import { dashboardSchema, detailSchema } from "./schema";

export async function loadDashboard(season: number | null) {
  const context = await requireReporting();
  const { data, error } = await context.client.rpc("report_dashboard", {
    season: season as number,
    detailed: false,
  });
  if (error) throw new Error("Het dashboard kon niet worden geladen.");
  return { ...context, dashboard: dashboardSchema.parse(data) };
}
export async function loadDetail(season: number) {
  const context = await requireReporting();
  const { data, error } = await context.client.rpc("report_dashboard", {
    season,
    detailed: true,
  });
  if (error) throw new Error("Rapportage kon niet worden geladen.");
  return { ...context, detail: detailSchema.parse(data) };
}
