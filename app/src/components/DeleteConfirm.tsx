import { AlertTriangle } from "lucide-react";
import styles from "./DeleteConfirm.module.css";

interface Props {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirm({ name, onConfirm, onCancel }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.icon}>
          <AlertTriangle size={22} />
        </div>
        <h3 className={styles.title}>Delete provider?</h3>
        <p className={styles.desc}>
          <strong>{name}</strong> will be permanently removed from your wallet.
        </p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.deleteBtn} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
