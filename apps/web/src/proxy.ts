import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap, optimistic redirect based on the presence of a session cookie.
 * The API still verifies the session on every request; this only improves UX.
 */
export function proxy(request: NextRequest) {
  const signedIn = Boolean(getSessionCookie(request));
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === '/sign-in' || pathname === '/sign-up';

  if (!signedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  if (signedIn && (isAuthPage || pathname === '/')) {
    return NextResponse.redirect(new URL('/app', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the API proxy, public share pages, and static files.
  matcher: ['/((?!api|s/|_next/|icon.svg|favicon.ico).*)'],
};
