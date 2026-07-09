import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  ASSIGNABLE_ADMIN_ROLES,
  isAdminRole,
  permissionsForRoles,
  ROLE_PERMISSIONS,
  SUPERADMIN_ONLY_PERMISSIONS,
  SUPERADMIN_ROLE,
  sanitizeRoles,
} from '../server/admin_permissions';
import {
  ADMIN_ROUTE_PERMISSIONS,
  adminPathKnown,
  permissionForAdminRoute,
} from '../server/admin_routes';
import {
  ADMIN_PERMISSIONS as CLIENT_ADMIN_PERMISSIONS,
  hasPermission,
} from '../src/admin/permissions';

describe('admin permission vocabulary', () => {
  it('the client mirror never drifts from the server vocabulary', () => {
    expect([...CLIENT_ADMIN_PERMISSIONS]).toEqual([...ADMIN_PERMISSIONS]);
  });

  it('every route permission is a real permission or the any sentinel', () => {
    for (const rule of ADMIN_ROUTE_PERMISSIONS) {
      expect(rule.permission === 'any' || ADMIN_PERMISSIONS.includes(rule.permission)).toBe(true);
    }
  });

  it('superadmin holds every permission', () => {
    expect([...ROLE_PERMISSIONS.superadmin]).toEqual([...ADMIN_PERMISSIONS]);
  });

  it('staff.manage is reachable only through superadmin', () => {
    for (const role of ADMIN_ROLES) {
      if (role === SUPERADMIN_ROLE) continue;
      expect(ROLE_PERMISSIONS[role]).not.toContain('staff.manage');
    }
    expect(SUPERADMIN_ONLY_PERMISSIONS).toEqual(['staff.manage']);
  });

  it('assignable roles exclude superadmin', () => {
    expect(ASSIGNABLE_ADMIN_ROLES).not.toContain('superadmin');
    expect(ASSIGNABLE_ADMIN_ROLES).toEqual(ADMIN_ROLES.filter((r) => r !== 'superadmin'));
  });

  it('viewer excludes botdetector.read', () => {
    expect(ROLE_PERMISSIONS.viewer).not.toContain('botdetector.read');
  });

  it('permissionsForRoles unions across roles and ignores unknown role strings', () => {
    const perms = permissionsForRoles(['viewer', 'botdetector-unknown', 'moderator']);
    expect(perms.has('accounts.read')).toBe(true);
    expect(perms.has('moderation.act')).toBe(true);
    expect(perms.has('staff.manage')).toBe(false);
  });

  it('isAdminRole rejects unknown values', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('owner')).toBe(false);
    expect(isAdminRole(42)).toBe(false);
  });

  it('sanitizeRoles rejects a non-array or an unknown role, dedupes and orders', () => {
    expect(sanitizeRoles('admin')).toBeNull();
    expect(sanitizeRoles(['admin', 'owner'])).toBeNull();
    expect(sanitizeRoles(['viewer', 'admin', 'admin'])).toEqual(['admin', 'viewer']);
  });

  it('hasPermission is a plain membership check', () => {
    expect(hasPermission(['accounts.read'], 'accounts.read')).toBe(true);
    expect(hasPermission(['accounts.read'], 'staff.manage')).toBe(false);
  });
});

describe('admin route permission table', () => {
  it('resolves a known GET route', () => {
    expect(permissionForAdminRoute('GET', '/admin/api/overview')).toBe('analytics.read');
  });

  it('resolves a regex-matched route', () => {
    expect(permissionForAdminRoute('GET', '/admin/api/accounts/42')).toBe('accounts.read');
  });

  it('returns null for an unmapped path', () => {
    expect(permissionForAdminRoute('GET', '/admin/api/nope')).toBeNull();
  });

  it('returns null for a known path under the wrong method', () => {
    expect(permissionForAdminRoute('POST', '/admin/api/overview')).toBeNull();
    expect(adminPathKnown('/admin/api/overview')).toBe(true);
  });

  it('/me is reachable by any staff account', () => {
    expect(permissionForAdminRoute('GET', '/admin/api/me')).toBe('any');
  });
});
