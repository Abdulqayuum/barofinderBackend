export function generateInvoiceNumber(sequence) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  return `INV-${y}${m}${d}-${seq}`;
}
