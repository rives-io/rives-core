import { NextRequest, NextResponse } from "next/server";
import { getSession } from "./lib";

export const config = {
  matcher: []
  //matcher: ['/play/:path*', '/cartridges/:path*'],
  //matcher: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
}

export async function middleware(request: NextRequest) {
    const session = await getSession();
    const pathname = request.nextUrl.pathname
  
    // Redirect to login page if not authenticated
    if (!session && pathname != "/login" ) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}