"use client";
import { PublicShell } from "@/components/public-shell";
import { ErrorState } from "@/components/states";
export default function Error({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <PublicShell>
      <div className="public-width state-page">
        <h1 className="mb-6 text-3xl font-semibold">
          Even geen verbinding met dit scherm
        </h1>
        <ErrorState onRetry={retry} />
      </div>
    </PublicShell>
  );
}
