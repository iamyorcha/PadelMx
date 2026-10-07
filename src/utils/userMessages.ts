/**
 * Translates technical error codes and exception messages into friendly, actionable language for users.
 */
export function getHumanReadableErrorMessage(error: unknown, fallbackMessage = 'Ha ocurrido un error inesperado.'): string {
  if (!error) return fallbackMessage;

  const errStr = typeof error === 'string' 
    ? error 
    : (error as any)?.message || (error as any)?.code || String(error);

  const lower = errStr.toLowerCase();

  // Firestore & Auth Permission Errors
  if (lower.includes('permission-denied') || lower.includes('permission_denied') || lower.includes('insufficient permissions')) {
    return 'No tienes permisos de edición sobre este torneo o tu sesión ha expirado. Si eres un espectador, estás en modo de solo lectura.';
  }

  // Network & Connectivity Issues
  if (lower.includes('network') || lower.includes('unavailable') || lower.includes('offline') || lower.includes('failed to fetch') || lower.includes('deadline-exceeded')) {
    return 'Problema de conexión temporal. Tus cambios están guardados en este dispositivo y se sincronizarán al recuperar la red.';
  }

  // Missing or Not Found
  if (lower.includes('not-found') || lower.includes('not_found') || lower.includes('document does not exist')) {
    return 'El torneo solicitado ya no está disponible o ha sido eliminado.';
  }

  // Unauthenticated
  if (lower.includes('unauthenticated') || lower.includes('auth/')) {
    return 'Tu sesión de usuario ha expirado. Por favor, vuelve a identificarte para guardar los cambios.';
  }

  // Quota / Rate limits
  if (lower.includes('resource-exhausted') || lower.includes('quota')) {
    return 'El servidor está recibiendo muchas peticiones en este momento. Por favor espera unos segundos e inténtalo de nuevo.';
  }

  // Payload or format validation
  if (lower.includes('invalid-argument') || lower.includes('invalid id') || lower.includes('validation')) {
    return 'Los datos del torneo contienen valores no válidos o incompatibles.';
  }

  return fallbackMessage;
}
