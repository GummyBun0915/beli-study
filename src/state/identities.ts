// Public login identifiers only. Passwords are verified by Supabase and never stored here.
export const identities = [
  { name: 'WXY', email: 'wxy@beli.example.com' },
  { name: 'LHJ', email: 'lhj@beli.example.com' },
] as const;
export type IdentityName = typeof identities[number]['name'];
export function identityForEmail(email?: string) {
  return identities.find(identity => identity.email === email?.toLowerCase());
}
