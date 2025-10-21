import React from "react";
import styles from "./DeleteConfirm.module.css";
import { FaCheck, FaTimes } from "react-icons/fa";
interface DeleteConfirmProps {
  open: boolean;
  fileName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  anchorRef?: HTMLButtonElement | null;
}

const DeleteConfirm: React.FC<DeleteConfirmProps> = ({
  open,
  onConfirm,
  onCancel,
  anchorRef,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null
  );

  React.useEffect(() => {
    if (open && anchorRef) {
      const rect = anchorRef.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY - 65,
        left: rect.left + window.scrollX + rect.width + 8,
      });
    } else {
      setPos(null);
    }
  }, [open, anchorRef]);

  if (!open || !anchorRef || !pos) return null;
  return (
    <div
      className={styles.overlay}
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        background: "none",
        width: "auto",
        height: "auto",
        zIndex: 3000,
      }}
    >
      <div ref={dialogRef} className={styles.dialog}>
        <div className={styles.actions}>
          <button className={styles.confirm} onClick={onConfirm}>
            {/* 钩 */}
            <FaCheck />
          </button>
          <button className={styles.cancel} onClick={onCancel}>
            {/* 叉 */}
            <FaTimes />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirm;
