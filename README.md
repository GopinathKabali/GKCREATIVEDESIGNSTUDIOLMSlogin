# GK Creative Design Studio — Office LMS

PowerPoint, Word, and Excel learning portal with 106 Drive-hosted video lessons and 15 supporting files.

## Authentication
Clerk manages student registration, verification, login, recovery, account settings, and logout. Use the New student, Student login, or Admin login tab on the home page.

Server requests verify Clerk session tokens, restrict authorized origins, and check the verified primary email for admin access. New accounts are students. The authorized initial administrator is gopinath88.work@gmail.com; this account must be registered and verified by its owner. There is no default password and no client-side role promotion.

The admin dashboard provides a paginated account directory and per-course completion counts. Course links and resources are fetched only after authentication. Existing Drive sharing still controls access to the underlying files.

Progress is stored through the server in Clerk private user metadata, within the small catalog's storage budget. Completion is learner-declared rather than proof of video watch time. Updates are serialized in each browser tab; simultaneous edits on multiple devices use the most recent saved state.

## Deployment
Required Vercel variables: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY (provisioned by Clerk). Never commit secret keys.

Run npm ci, npm test, npm run build. Vercel uses vercel.json to publish only the public/ build assets and api/ functions. lib/ contains server-only course data. The former public catalog.js was removed.

## Verification
Backend tests cover unauthenticated access, student/admin separation, verified admin identity, origin checks, disabled accounts, progress validation, self-only writes, and private no-store responses. Final sign-up and admin login require the owner to complete their email verification; no account is created on their behalf.
