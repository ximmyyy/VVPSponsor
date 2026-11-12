import {
  CircleAlert,
  FolderOpen,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export function EmptyState({
  title,
  description,
  icon: Icon = FolderOpen,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state">
      <div className="state-icon">
        <Icon aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function ErrorState({
  title = "Dit onderdeel kon niet worden geladen",
  description = "Probeer het opnieuw. Blijft het probleem bestaan? Probeer het dan later nog eens.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="error-state">
      <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {onRetry && (
          <Button className="mt-4" variant="outline" onClick={onRetry}>
            Opnieuw proberen
          </Button>
        )}
      </div>
    </div>
  );
}
export function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-5"
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle
          className="size-4 motion-safe:animate-spin"
          aria-hidden="true"
        />{" "}
        Gegevens worden geladen…
      </p>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}
