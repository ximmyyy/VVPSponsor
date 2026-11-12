import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const client = await createSessionClient(true);
  if (token && (type === "invite" || type === "recovery")) {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type });
    if (!error)
      return new NextResponse(null, {
        status: 303,
        headers: {
          Location: "/wachtwoord",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
  }
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/herstellen",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
