export const ADMIN_EMAIL = 'gopinath88.work@gmail.com';
export function primaryEmail(user) {
  return user.emailAddresses?.find(e => e.id === user.primaryEmailAddressId);
}
export function roleFor(user) {
  const email = primaryEmail(user);
  return email?.verification?.status === 'verified' && email.emailAddress.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'student';
}
export function accessFor(user, courses) {
  if (roleFor(user) === 'admin') return { status: 'approved', courseIds: courses.map(c => c.id), emailVerified: true };
  const stored = user.privateMetadata?.gkLms?.access;
  const emailVerified = primaryEmail(user)?.verification?.status === 'verified';
  const status = ['approved', 'rejected', 'revoked'].includes(stored?.status) ? stored.status : 'pending';
  const courseIds = emailVerified && status === 'approved' && Array.isArray(stored?.courseIds) ? courses.filter(c => stored.courseIds.includes(c.id)).map(c => c.id) : [];
  return { status, courseIds, emailVerified, reviewedAt: stored?.reviewedAt || null };
}
export function progressFor(user, courses) {
  const source = user.privateMetadata?.gkLms?.progress || {};
  return Object.fromEntries(courses.map(c => [c.id, c.lessons.filter(l => Array.isArray(source[c.id]) && source[c.id].includes(l.id)).map(l => l.id)]));
}
export function validateProgress(value, courses) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some(k => !courses.some(c => c.id === k))) return null;
  const result = {};
  for (const c of courses) {
    const ids = value[c.id] ?? [];
    if (!Array.isArray(ids) || ids.length > c.lessons.length || ids.some(id => typeof id !== 'string' || !c.lessons.some(l => l.id === id))) return null;
    result[c.id] = [...new Set(ids)];
  }
  return result;
}
