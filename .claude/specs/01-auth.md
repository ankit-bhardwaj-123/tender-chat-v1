# Spec 01: Sign up and sign in (email, Google, GitHub) + sidebar

Status: planned · 2026-11-25

## Goal

A contractor creates an account and signs in with email and password, or with Google or GitHub. They stay signed in, can sign out of this device or of all devices, and see the app frame: a sidebar with their user menu. We build it first because every later feature needs to know who the user is. The login system is our own (JWT access token + JWT refresh token), not a library like better-auth. Tenders come in a later spec.

## What the user does

1. Signed out, the user opens any page → they land on the login page: email, password, "Sign in", "Continue with Google", "Continue with GitHub", and a link "Create an account".
2. On "Create an account" they type full name, email, password and confirm password → they are signed in straight away and see the home page.
3. On the login page they type email and password → they see the home page, or the page they first tried to open.
4. They click "Continue with Google" or "Continue with GitHub" and approve on that site → they come back signed in. The first time, an account is made from the full name and email the site gives us.
5. While they use the app, the short login pass (access token, 15 minutes) renews itself in the background using the refresh token. They never notice.
6. Signed in, they see the sidebar on the left and the main area on the right. The sidebar has the app name at the top and the user icon at the bottom. The space for tenders shows nothing yet.
7. They click the user icon → a menu shows their full name and email, "Sign out" and "Sign out of all devices".
8. "Sign out" → this device is signed out and they see the login page.
9. "Sign out of all devices" → every device and browser is signed out, including this one.

## What we save or produce

- The user: full name, email, and the password only as a scrambled hash (never the password itself). Users who only use Google or GitHub have no password.
- How the user signs in (email, Google or GitHub), and the linked Google or GitHub account.
- One login record per device for the refresh token, so one device or all devices can be signed out. We keep only a hash of the token, not the token itself.
- Two httpOnly cookies (cookies the page's JavaScript can't read):
  - access token: a JWT (signed token) that lasts 15 minutes
  - refresh token: a JWT that lasts 30 days, signed with a different secret

## Rules

- Every page except login and sign-up needs the user to be signed in.
- Password: at least 8 characters, no other rules.
- Email is not case-sensitive (`A@x.com` is the same as `a@x.com`).
- One email, one sign-in method. If an email already has an account (with a password, or from the other site), signing in with Google or GitHub using that email is refused.
- A login lasts 30 days if the app is used. After that, sign in again.
- Each refresh gives a new refresh token and the old one stops working. An old refresh token used a second time (a sign it was stolen) signs out that whole device chain.
- Sign-in limit: 5 wrong tries in 15 minutes for one email or IP, then wait.
- Sign-up limit: at most 5 new accounts in a day from one IP.
- A user sees only their own data. Someone else's row answers "not found" (404).

## When something goes wrong

| What happens | What the user sees |
| --- | --- |
| Wrong email or password | "Email or password is wrong" (same message for both) |
| Email already used at sign-up | "An account with this email already exists" |
| Google/GitHub email already has an account | "This email is already registered. Sign in the way you signed up." |
| Passwords don't match, or under 8 characters | A message under the field |
| Too many sign-in tries | "Too many attempts, try again in a few minutes" |
| More than 5 sign-ups in a day | "Too many accounts created today, try again tomorrow" |
| They cancel on Google/GitHub, or it fails | Back on the login page: "Couldn't sign in, please try again." |
| Login expired, or signed out from another device | Sent to the login page: "Please sign in again" |
| Server or network error | A red toast: "Something went wrong, please try again" |

## Not in this feature

- Tenders: list, search, "+ New tender", rename, delete (a later spec).
- Companies and Templates links in the user menu (they come with their own specs).
- Forgot/reset password, email verification, sending any email.
- Changing full name, email or password; a profile page.
- A list of signed-in devices (only "sign out of all devices").
- Admin or team accounts.

## Decisions (answered 2026-11-25)

- A GitHub user who hides their email is refused: "Your GitHub account doesn't share an email. Make it public or use another sign-in."
- Google/GitHub users will be able to set a password later, in its own spec. Not in this one.
- The sidebar stays empty (no search, no "+ New tender") until the tenders spec.
- The numbers stand: 8-character password, 30-day login, 5 wrong tries in 15 minutes, 5 sign-ups a day.

## Questions

- None

## Done when

- [ ] Opening `/` while signed out shows the login page.
- [ ] Sign up, sign in with email, sign in with Google, and sign in with GitHub each end on the home page with the sidebar.
- [ ] Google sign-in with an email that already has a password account is refused with the message above.
- [ ] Still signed in after the 15-minute access token expires (it renewed itself).
- [ ] The user menu shows full name and email.
- [ ] "Sign out" signs out this browser only; a second browser stays signed in.
- [ ] "Sign out of all devices" signs out both browsers.
- [ ] Reusing an old refresh token signs that device chain out.
- [ ] The 6th wrong password in 15 minutes shows "Too many attempts"; the 6th sign-up in a day is refused.
- [ ] A signed-out API call answers 401, and another user's data answers 404.
