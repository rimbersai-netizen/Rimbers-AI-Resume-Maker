import { NextResponse } from "next/server";

/**
 * Relative Location for route handlers: Next rewrites absolute same-origin redirects to its internal host
 * ("localhost"), which would drop host-bound auth cookies. Browsers resolve relative Locations correctly.
 */
export const relativeRedirect = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });
