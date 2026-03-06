/**
 * Lightweight, zero-dependency input validation for API routes.
 */

type FieldType = 'string' | 'number' | 'array' | 'object';

/**
 * Validate that `body` contains the required fields with the expected types.
 * Returns an error message string if validation fails, or null if everything is ok.
 *
 * Example:
 *   const err = requireFields(body, { topic: 'string', scores: 'array' });
 *   if (err) return NextResponse.json({ error: err }, { status: 400 });
 */
export function requireFields(
  body: unknown,
  fields: Record<string, FieldType>,
): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  const obj = body as Record<string, unknown>;

  for (const [name, type] of Object.entries(fields)) {
    const value = obj[name];

    if (value === undefined || value === null) {
      return `Missing required field: ${name}`;
    }

    switch (type) {
      case 'string':
        if (typeof value !== 'string' || value.trim() === '') {
          return `Field "${name}" must be a non-empty string`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          return `Field "${name}" must be a number`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `Field "${name}" must be an array`;
        }
        break;
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          return `Field "${name}" must be an object`;
        }
        break;
    }
  }

  return null;
}
