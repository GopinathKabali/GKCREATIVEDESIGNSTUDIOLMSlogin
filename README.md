# GK Creative Design Studio — Office LMS

Three courses: PowerPoint, Word, Excel. 106 Drive-hosted video lessons and 15 supporting files.

## Account access
Clerk manages registration, email verification, login, account settings, and logout. The admin portal is selected with ?mode=admin; the server independently verifies admin authorization.

The owner account gopinath88.work@gmail.com receives admin privileges only when it is the verified primary email on the authenticated Clerk account. All other accounts, including pre-existing students, default to pending review. Email verification alone does not approve learning access.

The administrator reviews registered accounts and selects which courses each learner may access. Approve selected requires a verified learner email and at least one valid course. Reject and Revoke clear course grants. Review status, selected courses, latest decision timestamp, and reviewing administrator are stored in Clerk private metadata. This is the latest decision record, not an append-only audit log.

Server endpoints filter the course catalog and progress by current permissions. Pending, rejected, revoked, and unverified learners receive no course links. Course opening rechecks permissions; open clients check access every minute and when returning to the tab. Revocation cannot retract a previously shared Drive URL, downloaded file, or a video already loaded outside the portal. Google Drive sharing is unchanged.

## Admin monitoring
The paginated account directory shows email verification, approval status, course progress, last sign-in, and last activity. View login sessions displays Clerk's session status, creation, last activity, and expiration with pagination. This is session monitoring, not a complete log of failed authentication attempts or page views.

## Progress
Stored server-side in Clerk private metadata for the authenticated learner. Completion is self-reported, not video-watch verification. Changes in one browser tab are serialized; concurrent devices use the latest saved state.

## Build and deployment
npm ci; npm test; npm run build. Required environment variables: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, provisioned through the Vercel Clerk integration. Never commit secrets. Vercel publishes only the public/ assets and api/ functions; the course catalog stays in server-only lib/courses.json.

24 tests cover session restrictions, verified admin authorization, pending users, per-course grants, revoked users, self-approval denial, admin-only session monitoring, approval validation, learner-specific writes, and UI rendering. Owner login and actual learner approval require verified accounts. The installed Clerk instance is currently in development mode; configure production Clerk keys before student launch.
