import { AuthSession, PlatformRole, TenantRole } from '@/types';

export class AuthorizationError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code = 'FORBIDDEN', statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Validates that the active session is a platform user (Super Admin, Admin, Support).
 */
export function assertPlatformAccess(session: AuthSession | null, allowedRoles?: PlatformRole[]): AuthSession {
  if (!session) {
    throw new AuthorizationError('Authentication required.', 'UNAUTHORIZED', 401);
  }

  if (!session.isPlatformUser || !session.platformRole) {
    throw new AuthorizationError('Platform administrator privileges required.', 'FORBIDDEN_PLATFORM_REQUIRED', 403);
  }

  if (allowedRoles && !allowedRoles.includes(session.platformRole)) {
    throw new AuthorizationError(
      `Insufficient platform permissions. Required: ${allowedRoles.join(', ')}`,
      'FORBIDDEN_ROLE_INSUFFICIENT',
      403
    );
  }

  return session;
}

/**
 * Strictly verifies tenant access and guards against IDOR attacks.
 * Verifies that the user belongs to targetTenantId and holds required tenant roles.
 * Allows Platform Admins in Support/Impersonation Mode.
 */
export function assertTenantAccess(
  session: AuthSession | null,
  targetTenantId: string,
  allowedRoles?: TenantRole[]
): AuthSession {
  if (!session) {
    throw new AuthorizationError('Authentication required.', 'UNAUTHORIZED', 401);
  }

  // Check if this is a platform admin impersonating or operating in support mode
  if (session.isPlatformUser && (session.platformRole === 'SUPER_ADMIN' || session.platformRole === 'ADMIN')) {
    return session;
  }

  // Tenant-scoped user: targetTenantId MUST match session.tenantId exactly
  if (session.tenantId !== targetTenantId) {
    throw new AuthorizationError(
      'Access denied: Cross-tenant access is strictly prohibited.',
      'CROSS_TENANT_ACCESS_DENIED',
      403
    );
  }

  if (allowedRoles && session.tenantRole) {
    const roleHierarchy: Record<TenantRole, number> = {
      OWNER: 5,
      ADMIN: 4,
      MANAGER: 3,
      STAFF: 2,
      VIEWER: 1,
    };

    const userLevel = roleHierarchy[session.tenantRole] ?? 0;
    const isAllowed = allowedRoles.some((r) => userLevel >= roleHierarchy[r]);

    if (!isAllowed) {
      throw new AuthorizationError(
        `Insufficient tenant permissions. Required: ${allowedRoles.join(', ')}`,
        'FORBIDDEN_ROLE_INSUFFICIENT',
        403
      );
    }
  }

  return session;
}
