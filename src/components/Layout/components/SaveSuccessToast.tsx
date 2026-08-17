import React from 'react';
import { LuCheck } from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';
import styles from './SaveSuccessToast.module.css';

interface SaveSuccessToastProps {
  show: boolean;
  message?: string;
}

const SaveSuccessToast: React.FC<SaveSuccessToastProps> = ({ show, message }) => {
  const { t } = useI18n();

  return (
    <div
      className={`${styles.toast} ${show ? styles.visible : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={!show}
      aria-label={message ?? t('file.saved')}
    >
      <LuCheck aria-hidden="true" />
      <span>{message ?? t('file.saved')}</span>
    </div>
  );
};

export default SaveSuccessToast;
