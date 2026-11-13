import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env/public";
import { isLocalDesignPreview } from "@/lib/design-preview";

// Ontwerproutes alleen lokaal; overige routes krijgen sessieverversing en private headers.
// Autorisatie gebeurt per pagina (getUser + DB-rechten) en in de database (RLS).
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    !path.startsWith("/beheer") &&
    !path.startsWith("/portaal") &&
    !path.startsWith("/ontwerp")
  ) {
    const env = getPublicEnv();
    let response = NextResponse.next({ request });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    const client = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookieOptions: {
          sameSite: "lax",
          secure: new URL(env.NEXT_PUBLIC_APP_URL).protocol === "https:",
        },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (values, cacheHeaders) => {
            for (const { name, value } of values)
              request.cookies.set(name, value);
            response = NextResponse.next({ request });
            for (const { name, value, options } of values)
              response.cookies.set(name, value, options);
            for (const [key, value] of Object.entries(cacheHeaders))
              response.headers.set(key, value);
            response.headers.set("Cache-Control", "private, no-store");
            response.headers.set("Referrer-Policy", "no-referrer");
          },
        },
      },
    );
    // Ververst de sessie; met asymmetrische sleutels lokaal geverifieerd (gecachte JWKS),
    // dus zonder Auth-serverronde. Pagina's controleren daarna zelf getUser() + DB-rechten.
    await client.auth.getClaims();
    return response;
  }
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
  matcher: [
    "/beheer/:path*",
    "/portaal/:path*",
    "/ontwerp/:path*",
    "/account/:path*",
    "/inloggen",
    "/herstellen",
    "/wachtwoord",
    "/auth/:path*",
    "/geen-toegang",
    "/mfa",
  ],
};
