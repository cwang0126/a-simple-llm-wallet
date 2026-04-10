import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import styles from "./DeleteConfirm.module.css";

interface Props {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirm({ name, onConfirm, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.icon}>
          <AlertTriangle size={22} />
        </div>

        {step === 1 ? (
          <>
            <h3 className={styles.title}>Delete provider?</h3>
            <p className={styles.desc}>
              <strong>{name}</strong> will be permanently removed from your wallet.
              This cannot be undone.
            </p>
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
              <button className={styles.deleteBtn} onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className={styles.title}>Are you sure?</h3>
            <p className={styles.desc}>
              Click <strong>Delete</strong> to permanently remove <strong>{name}</strong>.
            </p>
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
              <button className={styles.deleteBtn} onClick={onConfirm}>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
