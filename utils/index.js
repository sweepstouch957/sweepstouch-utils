export function getPagination(req) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function formatPhone(raw) {
  // Remueve cualquier carácter no numérico
  const phone = raw.replace(/\D/g, "");
  if (phone.startsWith("1")) {
    // Si ya inicia con 1 y tiene al menos 11 dígitos, prepende "+"
    return phone.startsWith("1") && !raw.startsWith("+")
      ? `+${phone}`
      : raw.startsWith("+1")
      ? raw
      : `+1${phone.slice(1)}`;
  }
  // Si no inicia con 1, prepende "+1"
  return `+1${phone}`;
}
