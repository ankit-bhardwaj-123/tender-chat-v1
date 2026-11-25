---
name: frontend-patterns
description: How to write tender-chat-v1 UI - Next 16 App Router pages with Cache Components, Server vs Client Component split, loading.tsx/error.tsx, function-only code (no classes), the apiRequest() function for cookie-auth fetches, controlled forms checked with src/contracts zod schemas, and shadcn (base-nova, Base UI) + Tailwind v4 parts. Use when adding or reviewing a page, layout, form, component, toast, menu or dialog under src/app or src/frontend.
---

# Frontend patterns (tender-chat-v1)

Status: **mostly planned.** Built today: the starter `app/layout.tsx` and `app/page.tsx`, `components/ui/button.tsx`, `lib/utils.ts` and `app/globals.css`, all still at the root until Plan 01 step 1 moves them to `src/`. The functions and forms below come from Plan 01 steps 13-16 (`.claude/plans/01-auth.md`). Once they exist, check each example against the real file and cite `path:line` instead.

## Stack (what's actually there)

| Thing | Status |
| --- | --- |
| Next 16.4 App Router, `cacheComponents: true`, `partialPrefetching: true` (`next.config.ts`) | built |
| React 19.3 (no React Compiler) | built |
| Tailwind v4, CSS-first: tokens in `globals.css` `@theme inline` + `:root`/`.dark`, no `tailwind.config` | built |
| shadcn `base-nova` style on **Base UI** (`@base-ui/react`), not Radix; icons `lucide-react` | built |
| Class merge: `cn` package (`lib/utils.ts` re-exports it), not clsx + tailwind-merge | built |
| `cva` variants (see `components/ui/button.tsx`) | built |
| zod (forms + routes), sonner toast via shadcn | planned (Plan 01 step 2, needs a yes) |
| React Hook Form, TanStack Query, SWR, Zustand, framer-motion | **not used**: don't add them |

## Where things go

- `src/app/`: pages, layouts, `loading.tsx` and `error.tsx` only. Route groups `(auth)/` (login, signup) and `(app)/` (sidebar frame).
- `src/frontend/<area>/`: feature components (`auth/LoginForm`, `layout/AppSidebar`, `layout/UserMenu`).
- `src/frontend/ui/`: shadcn parts. Add them with the shadcn CLI and don't hand-write them. Keep `components.json` aliases pointing here after the move.
- `src/frontend/api/`: `api-request.ts` (`apiRequest()`, `ApiError`), `auth-api.ts` (`authApi`). `src/frontend/forms/`: `field-errors.ts` (`fieldErrors()`).
- **Functions only (owner rule).** Components are function components, and logic outside the JSX is plain exported functions and custom hooks. No classes in `src/frontend/` or pages. The one exception is `ApiError extends Error`, so `instanceof` works in `catch`.

## Server vs Client Components

- **Server Component by default.** Pages and layouts load their data on the server: `(app)/layout.tsx` calls `requireUser()`, and `(app)/page.tsx` shows "Welcome, <full name>".
- **Push `"use client"` down** to small interactive leaves (a form, `UserMenu`, a toast trigger). Pass plain serialisable props (`{ fullName, email }`), never tokens.
- **Cache Components is on.** Anything that reads `cookies()`/`headers()`, including `getCurrentUser()`, must render inside `<Suspense>` (or under a `loading.tsx`). Otherwise the build fails on uncached data. Don't add `"use cache"` to per-user data.
- `loading.tsx` handles segment loading, and `<Suspense>` closer to the data is better when only part of the page waits.
- `error.tsx` must be a Client Component. In Next 16 it gets `{ error, retry }`: use `retry()` for the "Try again" button (`reset()` is only for re-rendering without re-fetching). Don't write class `ErrorBoundary`s.
- Read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` and `.../03-file-conventions/error.md` before going further.

```tsx
// src/app/(app)/layout.tsx (shape)
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<SidebarSkeleton />}>
      <AppFrame>{children}</AppFrame>        {/* async server component: await requireUser() */}
    </Suspense>
  );
}
```

## Data fetching and mutations

- **Initial loads:** Server Components call services through the container directly. No `fetch` to our own API from the server.
- **Mutations and client calls** go through `apiRequest()`, never a bare `fetch`:
  - `request()` sends `credentials: "same-origin"`, so the httpOnly cookies travel. JS never reads or stores a token.
  - On **401** it calls `/api/auth/refresh` once and retries. Parallel 401s share one module-level refresh promise, and `navigator.locks` stops two tabs refreshing at once. If the refresh fails, it goes to `/login?reason=expired`.
  - Non-2xx bodies are `{ error: { message, code } }`; `apiRequest()` throws them as an `ApiError` with `message`, `code` and `status`.
- `authApi` is a plain object of functions, one per auth route: `signup`, `login`, `logout`, `logoutAll`, each calling `apiRequest()`.
- After a mutation that changes server data, call `router.refresh()` (or navigate) so Server Components re-render. Don't mirror server data in client state.
- No Server Actions: the plan uses API routes plus `apiRequest()`.

## Forms (shared zod contracts)

- The schema lives once in `src/contracts/<area>.contracts.ts` (e.g. `signupSchema`, `loginSchema`); the route parses the same schema on the server.
- Use controlled inputs with `useState`. On submit, call `schema.safeParse(values)`. If it fails, `fieldErrors(result.error)` gives `{ email: "…" }`, one message per field.
- While busy, the button is disabled and shows "Signing in…".
- Field errors go under their field (`aria-invalid` + `aria-describedby`). A server `ApiError.message` goes under the form, and a network or 500 error becomes a red toast ("Something went wrong, please try again").
- On success: `router.replace(next ?? "/")`.
- Add no rules beyond what the spec asks for (owner rule).

```tsx
// src/frontend/auth/LoginForm.tsx (shape)
"use client";
const result = loginSchema.safeParse(values);
if (!result.success) return setErrors(fieldErrors(result.error));
try { await authApi.login(result.data); router.replace(next ?? "/"); }
catch (error) { error instanceof ApiError && error.status < 500 ? setFormError(error.message) : toast.error("Something went wrong, please try again"); }
```

## UI and accessibility

- **Compose the shadcn and Base UI parts.** Don't hand-roll keyboard or focus logic for menus, dialogs, tabs, selects or tooltips. Base UI already ships `menu`, `dialog`, `alert-dialog`, `tabs`, `select`, `popover`, `tooltip`, `field`, `form` and `toast`; add the shadcn wrapper (`pnpm dlx shadcn@latest add dropdown-menu`) and use it.
- **Base UI, not Radix:** to make a trigger render as another element, use the `render` prop, not `asChild`. When the rendered element isn't a `<button>`, add `nativeButton={false}`: `<Button nativeButton={false} render={<Link href="/signup" />}>` (`node_modules/@base-ui/react/internals/types.d.ts:33-43`).
- Style with Tailwind utilities and the theme tokens (`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`); no hard-coded hex. Add variants with `cva`, and merge classes with `cn(...)`.
- Every input has a `<Label htmlFor>`, and focus stays visible (the parts already use `focus-visible:ring-*`).
- Every data view has loading, error (with "Try again"), empty and data states. The sidebar's tender area is intentionally empty until the tenders spec.
- Fonts come from `next/font` (Geist) in the root layout. Replace the starter `metadata` title when building pages.

## Performance

- No `useMemo`/`useCallback`/`React.memo` by default; add one only for a measured problem.
- Large client-only parts (the A4 preview and PDF work in later specs) can use `next/dynamic`. Use `next/image` and `next/link`.

## Not in this project

- No tokens in `localStorage`, `sessionStorage`, JS state or URLs (cookies only).
- No Pages Router (`pages/`, `getServerSideProps`).
- No hand-rolled `useQuery`, no `DataLoader` render props, no global Context/reducer stores.
- No classes at all (no class components, `ErrorBoundary` classes or helper classes), except `ApiError`.
- No Radix-only APIs (`asChild`).
- No framer-motion (use `tw-animate-css` classes) and no `@tanstack/react-virtual`.
- No libraries that aren't in `package.json` without the owner's yes.
