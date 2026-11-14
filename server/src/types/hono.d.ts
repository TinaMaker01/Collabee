import 'hono'

declare module 'hono' {
  interface ContextVariableMap {
    user: { id: number; email: string; name: string; role: string; organizationId?: number | null }
    // Resolved by services/tenant.ts#requireTenantId; set lazily by the
    // first route handler that needs it, not by protectRoute itself.
    tenantId: number
  }
}
