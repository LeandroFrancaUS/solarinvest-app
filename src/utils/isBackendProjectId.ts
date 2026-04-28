// src/utils/isBackendProjectId.ts
// Returns true if the given id is a standard UUID (v1–v5), meaning it was
// persisted in the backend.  Legacy numeric ids ("1777347463969") or other
// locally-generated strings that are not UUIDs return false.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isBackendProjectId(id: string): boolean {
  return UUID_RE.test(id)
}
