/**
 * Single source of truth for the Meridian Labs tenant identifier.
 *
 * The gallery scripted demo and the whiteboard embed both branch on the
 * meridian-labs tenant, historically by comparing the raw string in three
 * separate places. One drifted spelling would silently disable the meridian
 * host bundle on the deployed gallery, so the literal and the predicate live
 * here and every branch calls through them. The fixture brand also reads the
 * constant so demo data cannot fork from the runtime check.
 */
export const MERIDIAN_LABS_TENANT = 'meridian-labs';

export function isMeridianLabsTenant(tenant: string | null | undefined): boolean {
  return tenant === MERIDIAN_LABS_TENANT;
}
