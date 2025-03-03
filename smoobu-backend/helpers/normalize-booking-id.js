
export function normalizeBookingId(id) {
  if (!id) return null;
  return String(id).trim();
}
