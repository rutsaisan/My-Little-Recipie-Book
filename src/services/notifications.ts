/**
 * Avisos del sistema (notificaciones): temporizador terminado, importación
 * lista y recordatorio de recetas «Por probar».
 *
 * Los genera el propio dispositivo mientras la app está abierta (aunque esté
 * en segundo plano). No hay servidor de avisos: si la app está cerrada del
 * todo, el sistema no la despierta.
 */

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermissionState {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/** Pide permiso (solo tras un gesto de la persona, como marcar una casilla). */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

interface NotifyOptions {
  body: string;
  /** Avisos con la misma etiqueta se sustituyen en vez de amontonarse. */
  tag: string;
  /** Solo si la app no está a la vista (si lo está, ya avisa ella). */
  onlyWhenHidden?: boolean;
}

export async function notify(title: string, { body, tag, onlyWhenHidden = false }: NotifyOptions): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  if (onlyWhenHidden && document.visibilityState === 'visible') return false;
  const options: NotificationOptions = {
    body,
    tag,
    icon: `${import.meta.env.BASE_URL}pwa-192.png`,
    badge: `${import.meta.env.BASE_URL}favicon.png`,
    lang: 'es',
  };
  try {
    // En móvil (y en la app instalada) las notificaciones van por el service worker.
    if ('serviceWorker' in navigator) {
      const registration = await Promise.race([
        navigator.serviceWorker.getRegistration(),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500)),
      ]);
      if (registration) {
        await registration.showNotification(title, options);
        return true;
      }
    }
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
