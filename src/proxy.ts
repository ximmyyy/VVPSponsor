import { NextResponse, type NextRequest } from "next/server";
import { isLocalDesignPreview } from "@/lib/design-preview";

// Tijdelijke ontwerpgrens, geen gebruikersautorisatie. Fase 3 vervangt dit patroon
// pas wanneer echte sessie-, rol- en databasecontroles zijn geïmplementeerd.
export function proxy(request: NextRequest) {
  if (isLocalDesignPreview(process.env, request.headers.get("host")))
    return NextResponse.next();
  return new NextResponse(
    '<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Pagina niet beschikbaar — VV Pernis</title></head><body><main><h1>Deze pagina is niet beschikbaar.</h1><p>Ga terug naar de <a href="/">startpagina</a>.</p></main></body></html>',
    {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
export const config = {
  matcher: ["/beheer/:path*", "/portaal/:path*", "/ontwerp/:path*"],
};
