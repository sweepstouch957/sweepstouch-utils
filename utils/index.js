import libphonenumber from "libphonenumber-js";


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



/**
 * Validar y formatear número de teléfono
 */
export function validatePhoneNumber(phone) {
  try {
    if (!phone || typeof phone !== "string") {
      return {
        isValid: false,
        error: "Número de teléfono requerido",
      };
    }

    // Limpiar el número
    const cleanPhone = phone.trim().replace(/[\s\-\(\)\.]/g, "");

    // Validar formato básico
    if (!/^\+?[1-9]\d{7,14}$/.test(cleanPhone)) {
      return {
        isValid: false,
        error: "Formato de número inválido",
      };
    }

    // Usar libphonenumber para validación avanzada
    const phoneNumber = libphonenumber.parsePhoneNumber(cleanPhone, "US");

    if (!phoneNumber || !phoneNumber.isValid()) {
      return {
        isValid: false,
        error: "Número de teléfono inválido",
      };
    }

    // Verificar que no sea un número de emergencia o servicio
    const emergencyNumbers = ["911", "112", "999", "000"];
    const nationalNumber = phoneNumber.nationalNumber;

    if (
      emergencyNumbers.some((emergency) => nationalNumber.includes(emergency))
    ) {
      return {
        isValid: false,
        error: "No se pueden enviar mensajes a números de emergencia",
      };
    }

    return {
      isValid: true,
      formatted: phoneNumber.format("E.164"),
      national: phoneNumber.format("NATIONAL"),
      country: phoneNumber.country,
      type: phoneNumber.getType(),
      carrier: phoneNumber.getCarrier?.() || "unknown",
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Error validando número: ${error.message}`,
    };
  }
}

/**
 * Sanitizar y validar mensaje
 */
export function sanitizeMessage(message) {
  if (!message || typeof message !== "string") {
    throw new Error("Mensaje requerido");
  }

  // Limpiar mensaje
  let sanitized = message.trim();

  // Remover caracteres de control excepto saltos de línea
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Normalizar espacios múltiples
  sanitized = sanitized.replace(/\s+/g, " ");

  // Validar longitud (SMS estándar: 160 caracteres, extendido: 1600)
  if (sanitized.length === 0) {
    throw new Error("Mensaje vacío después de sanitización");
  }

  if (sanitized.length > 1600) {
    throw new Error(
      `Mensaje demasiado largo: ${sanitized.length} caracteres (máximo 1600)`
    );
  }

  // Detectar y marcar caracteres especiales que pueden causar problemas
  const specialChars = /[^\x20-\x7E\n\r]/g;
  const hasSpecialChars = specialChars.test(sanitized);

  if (hasSpecialChars) {
    // Convertir caracteres especiales comunes
    sanitized = sanitized
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...");
  }

  return sanitized;
}

/**
 * Calcular delay para backoff exponencial
 */
export function exponentialBackoff(attempt, config) {
  const { baseDelay, maxDelay, exponentialBase } = config;
  const delay = Math.min(
    baseDelay * Math.pow(exponentialBase, attempt),
    maxDelay
  );

  // Agregar jitter aleatorio (±25%) para evitar thundering herd
  const jitter = delay * 0.25 * (Math.random() - 0.5);

  return Math.max(0, Math.floor(delay + jitter));
}

/**
 * Validar URL de imagen/media
 */
export function validateMediaUrl(url) {
  if (!url || typeof url !== "string") {
    return { isValid: false, error: "URL requerida" };
  }

  try {
    const urlObj = new URL(url);

    // Solo permitir HTTPS
    if (urlObj.protocol !== "https:") {
      return { isValid: false, error: "Solo se permiten URLs HTTPS" };
    }

    // Validar extensiones de archivo permitidas
    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".mp4",
      ".mov",
      ".pdf",
    ];
    const hasValidExtension = allowedExtensions.some((ext) =>
      urlObj.pathname.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return {
        isValid: false,
        error: `Extensión no permitida. Permitidas: ${allowedExtensions.join(
          ", "
        )}`,
      };
    }

    return {
      isValid: true,
      url: url.trim(),
      extension: allowedExtensions.find((ext) =>
        urlObj.pathname.toLowerCase().endsWith(ext)
      ),
    };
  } catch (error) {
    return {
      isValid: false,
      error: `URL inválida: ${error.message}`,
    };
  }
}

/**
 * Calcular número de segmentos SMS
 */
export function calculateSmsSegments(message) {
  const length = message.length;

  // SMS con caracteres estándar (GSM 7-bit)
  const hasUnicode = /[^\x00-\x7F]/.test(message);

  if (hasUnicode) {
    // Unicode SMS: 70 caracteres por segmento
    return Math.ceil(length / 70);
  } else {
    // GSM 7-bit: 160 caracteres para 1 segmento, 153 para múltiples
    if (length <= 160) return 1;
    return Math.ceil(length / 153);
  }
}

/**
 * Validar configuración de campaña
 */
export function validateCampaignConfig(config) {
  const errors = [];

  if (!config.campaignId) {
    errors.push("ID de campaña requerido");
  }

  if (!config.message || config.message.trim().length === 0) {
    errors.push("Mensaje requerido");
  }

  if (
    !config.phones ||
    !Array.isArray(config.phones) ||
    config.phones.length === 0
  ) {
    errors.push("Lista de teléfonos requerida");
  }

  if (config.scheduleDate && new Date(config.scheduleDate) < new Date()) {
    errors.push("Fecha de programación debe ser futura");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Rate limiting simple en memoria
 */
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Limpiar requests antiguos
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const keyRequests = this.requests.get(key);
    const validRequests = keyRequests.filter((time) => time > windowStart);

    this.requests.set(key, validRequests);

    if (validRequests.length >= this.maxRequests) {
      return {
        allowed: false,
        resetTime: windowStart + this.windowMs,
        remaining: 0,
      };
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return {
      allowed: true,
      remaining: this.maxRequests - validRequests.length,
      resetTime: windowStart + this.windowMs,
    };
  }
}

export const defaultRateLimiter = new RateLimiter();

/**
 * Detectar duplicados en lote de números
 */
export function findDuplicatePhones(phones) {
  const seen = new Set();
  const duplicates = new Set();

  for (const phone of phones) {
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, "");
    if (seen.has(cleanPhone)) {
      duplicates.add(cleanPhone);
    } else {
      seen.add(cleanPhone);
    }
  }

  return Array.from(duplicates);
}
