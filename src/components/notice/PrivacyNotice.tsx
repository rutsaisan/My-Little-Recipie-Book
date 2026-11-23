/**
 * Aviso de privacidad (la tarjeta de la galleta). Aparece la primera vez y
 * explica, sin letra pequeña, qué guarda la app: no hay cookies de
 * publicidad ni de seguimiento; todo vive en el propio dispositivo.
 */
import { useState } from 'react';
import { usePreferences } from '../../state/preferencesContext';
import { wipeAllData } from '../../services/wipeData';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { CookieArt, NoticeCard } from './NoticeCard';
import styles from './Notices.module.css';

export function PrivacyNotice() {
  const { prefs, loaded, setPref } = usePreferences();
  const [details, setDetails] = useState(false);
  const show = loaded && !prefs.privacyAccepted;

  return (
    <>
      {show && (
        <div className={styles.privacySlot}>
          <NoticeCard
            art={<CookieArt />}
            title="Tu privacidad nos importa"
            secondary={{ label: 'Más opciones', onClick: () => setDetails(true) }}
            primary={{ label: 'Aceptar', onClick: () => setPref('privacyAccepted', true) }}
          >
            Este recetario no usa cookies de publicidad ni de seguimiento. Tus recetas, fotos y ajustes se guardan solo
            en este dispositivo para que el libro funcione, también sin conexión.
            <br />
            Más información en nuestra{' '}
            <button type="button" onClick={() => setDetails(true)}>
              política de privacidad
            </button>
            .
          </NoticeCard>
        </div>
      )}
      <PrivacyDialog open={details} onClose={() => setDetails(false)} onAccept={() => setPref('privacyAccepted', true)} />
    </>
  );
}

interface PrivacyDialogProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

/** Política de privacidad y opciones (también desde «Personalizar»). */
export function PrivacyDialog({ open, onClose, onAccept }: PrivacyDialogProps) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  const close = () => {
    setConfirmWipe(false);
    onClose();
  };

  const wipe = async () => {
    setWiping(true);
    await wipeAllData();
    window.location.reload();
  };

  if (confirmWipe) {
    return (
      <Dialog
        open={open}
        title="¿Borrar todo lo guardado?"
        character="raton-pizza"
        onClose={() => !wiping && setConfirmWipe(false)}
        actions={
          <>
            <Button onClick={() => setConfirmWipe(false)} disabled={wiping}>
              No, volver
            </Button>
            <Button variant="danger" onClick={() => void wipe()} disabled={wiping}>
              {wiping ? 'Borrando…' : 'Sí, borrar todo'}
            </Button>
          </>
        }
      >
        Se borrarán de este dispositivo todas tus recetas, fotos, insignias y ajustes. No se puede deshacer.
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      title="Privacidad"
      character="gato-siames-bizcocho"
      onClose={close}
      actions={
        <>
          <Button variant="danger" size="sm" onClick={() => setConfirmWipe(true)}>
            Borrar todos mis datos
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onAccept?.();
              close();
            }}
          >
            Entendido
          </Button>
        </>
      }
    >
      <div className={styles.policy}>
        <p>
          <strong>Qué se guarda y dónde.</strong> Tus recetas, fotos, insignias y ajustes se guardan en el almacenamiento
          de este navegador (IndexedDB). No se envían a ningún servidor y no hay cuentas.
        </p>
        <p>
          <strong>Cookies.</strong> La app no usa cookies de publicidad, analítica ni seguimiento. Solo guarda una copia
          de sí misma para abrirse sin conexión.
        </p>
        <p>
          <strong>Dictado por voz.</strong> Al dictar, el reconocimiento de voz del navegador (por ejemplo, el de Chrome)
          puede enviar el audio a su servicio para pasarlo a texto. La app no guarda grabaciones.
        </p>
        <p>
          <strong>IA (Tom e importar vídeos).</strong> Solo funciona en un ordenador con la app instalada y Ollama: la IA
          trabaja en ese mismo ordenador y los vídeos no salen de él.
        </p>
        <p>
          <strong>Notificaciones.</strong> Solo si las activas en «Personalizar el libro»; las genera el propio
          dispositivo.
        </p>
      </div>
    </Dialog>
  );
}
