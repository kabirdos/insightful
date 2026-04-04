// Middleware intentionally left minimal - auth checks happen in route handlers and pages
export { default } from "next-auth/middleware";

export const config = {
  // Don't match any routes - let pages handle their own auth
  matcher: [],
};
