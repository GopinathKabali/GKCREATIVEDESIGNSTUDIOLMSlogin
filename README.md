# GK Creative Design Studio — Microsoft Office Learning

Branded responsive learning portal for Microsoft PowerPoint, Word, and Excel.

## Courses
- PowerPoint: 25 video lessons and 1 shortcut guide
- Word: 26 video lessons and 1 shortcut guide
- Excel: 55 video lessons and 13 supporting files

The catalog is grounded in the supplied Google Drive folder. Videos use Drive previews and have direct Drive fallback links. File permissions are unchanged. Drive login/access may be required. Some original filenames are abbreviated; these are retained rather than guessing their content. Video content has not been transcribed or reviewed.

## Local run
Serve this repository with a static HTTP server. There is no build step.

## Vercel
Framework: Other. Build command: empty. Output directory: repository root. Git main is the production source.

## Progress and authentication
Lesson progress currently saves in browser localStorage. It is not a server-verified record of viewing. Student registration and admin login are pending Clerk provisioning; no authentication or admin protection is claimed by this version. Install Clerk for this Vercel project, enable email/password sign-up with email verification, and assign the initial admin securely. Do not add passwords, secret keys, or a client-side admin role switch to source.

The next authentication implementation will use verified server sessions and a server-assigned admin role. New registrations must default to student. Shared account progress and student management need persistent storage.
