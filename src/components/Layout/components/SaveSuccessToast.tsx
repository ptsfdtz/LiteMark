import React from 'react';
import { LuCheck } from 'react-icons/lu';
import { useI18n } from '@/locales/useI18n';
import styles from './SaveSuccessToast.module.css';

const SaveSuccessToast: React.FC<{ show: boolean }> = ({ show }) => {
  const { t } = useI18n();

  return (
    <div
      className={`${styles.toast} ${show ? styles.visible : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={!show}
    >
      <LuCheck aria-hidden="true" />
      <span>{t('file.saved')}</span>
    </div>
  );
};

export default SaveSuccessToast;
