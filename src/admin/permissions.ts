// Client-side mirror of the admin permission vocabulary. The server is the
// authority (server/admin_permissions.ts gates every route); this list only
// drives presentation (sidebar filtering, hiding action buttons). Kept in
// lockstep with the server module by tests/admin_permissions.test.ts. The
// admin bundle never imports server code.

export const ADMIN_PERMISSIONS = [
  'analytics.read',
  'accounts.read',
  'support.read',
  'moderation.read',
  'moderation.act',
  'ipblocks.manage',
  'chatfilter.manage',
  'botdetector.read',
  'botdetector.configure',
  'staff.manage',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export function hasPermission(granted: readonly string[], permission: AdminPermission): boolean {
  return granted.includes(permission);
}
