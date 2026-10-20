import { NextResponse, type NextRequest } from "next/server";

/** Barreira leve: sem cookie de sessão → login. A validação real ocorre no servidor. */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("acl_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/projetos/:path*", "/p/:path*", "/apresentar/:path*"] };
