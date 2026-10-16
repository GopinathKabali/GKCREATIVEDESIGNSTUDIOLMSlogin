import { createClerkClient } from '@clerk/backend';
import courses from '../lib/courses.json' with { type: 'json' };
import { primaryEmail, roleFor, progressFor, validateProgress } from '../lib/access.js';

const productionOrigins = ['https://gkcreative-design-studio-lms.vercel.app', 'https://gkcreative-design-studio-lms-rhino20.vercel.app', 'https://gkcreative-design-studio-lms-git-main-rhino20.vercel.app'];
function allowedOrigins(env) {
  const result = [...productionOrigins];
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) if (host && /^[a-z0-9.-]+\.vercel\.app$/i.test(host)) result.push('https://' + host);
  return result;
}
export function makeHandler({ getClient, env = process.env, courseList = courses } = {}) {
  const origins = allowedOrigins(env);
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => res.status(status).json(body);
    const action = new URL(req.url, productionOrigins[0]).searchParams.get('action') || 'me';
    if (!['GET', 'PUT'].includes(req.method)) { res.setHeader('Allow', 'GET, PUT'); return send(405, { error: 'Method not allowed.' }); }
    if (action === 'config' && req.method === 'GET') {
      const key = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      if (!key?.match(/^pk_(test|live)_[A-Za-z0-9_-]+$/) || !env.CLERK_SECRET_KEY) return send(503, { error: 'Sign-in is temporarily unavailable. Please contact the studio.' });
      return send(200, { publishableKey: key });
    }
    if (!env.CLERK_SECRET_KEY || !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return send(503, { error: 'Authentication is not configured.' });
    const token = req.headers.authorization;
    if (typeof token !== 'string' || !/^Bearer \S+$/.test(token)) return send(401, { error: 'Please sign in to continue.' });
    if (req.method === 'PUT' && (!origins.includes(req.headers.origin) || !String(req.headers['content-type'] || '').startsWith('application/json'))) return send(403, { error: 'Request origin or content type is not allowed.' });
    const client = getClient ? getClient() : createClerkClient({ secretKey: env.CLERK_SECRET_KEY, publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
    let user;
    try {
      const verified = await client.authenticateRequest(new Request(productionOrigins[0] + '/api/lms', { headers: { authorization: token } }), { authorizedParties: origins, acceptsToken: 'session_token' });
      if (!verified.isSignedIn) return send(401, { error: 'Your session expired. Please sign in again.' });
      const auth = verified.toAuth();
      if (!auth.userId) return send(401, { error: 'Please sign in to continue.' });
      user = await client.users.getUser(auth.userId);
    } catch { return send(401, { error: 'Unable to verify your session. Please sign in again.' }); }
    if (user.banned || user.locked) return send(403, { error: 'This account cannot access the portal.' });
    try {
      if (action === 'me' && req.method === 'GET') return send(200, { id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(' ') || primaryEmail(user)?.emailAddress || 'Learner', role: roleFor(user), progress: progressFor(user, courseList) });
      if (action === 'courses' && req.method === 'GET') return send(200, { courses: courseList });
      if (action === 'progress' && req.method === 'PUT') {
        if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > 7000) return send(413, { error: 'Progress request is too large.' });
        const progress = validateProgress(req.body?.progress, courseList);
        if (!progress) return send(400, { error: 'Invalid course or lesson progress.' });
        await client.users.updateUserMetadata(user.id, { privateMetadata: { gkLms: { progress, updatedAt: new Date().toISOString() } } });
        return send(200, { progress });
      }
      if (action === 'admin' && req.method === 'GET') {
        if (roleFor(user) !== 'admin') return send(403, { error: 'Administrator access is required.' });
        const offsetRaw = new URL(req.url, productionOrigins[0]).searchParams.get('offset') || '0';
        if (!/^\d+$/.test(offsetRaw) || Number(offsetRaw) > 100000) return send(400, { error: 'Invalid page.' });
        const offset = Number(offsetRaw), limit = 20;
        const { data, totalCount } = await client.users.getUserList({ limit, offset, orderBy: '-created_at' });
        return send(200, { totalCount, offset, limit, users: data.map(u => ({ id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Learner', email: primaryEmail(u)?.emailAddress || '', verified: primaryEmail(u)?.verification?.status === 'verified', role: roleFor(u), createdAt: u.createdAt, progress: Object.fromEntries(courseList.map(c => [c.id, progressFor(u, courseList)[c.id].length])) })) });
      }
      return send(404, { error: 'Unknown endpoint.' });
    } catch { return send(503, { error: 'The learning service is temporarily unavailable. Please try again.' }); }
  };
}
export default makeHandler();
