import React from 'react';

const SaveSuccessToast: React.FC<{ show: boolean }> = ({ show }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 56,
        right: 16,
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1)' : 'scale(0.7)',
        transition: 'opacity 0.4s, transform 0.4s',
        background: 'var(--success-feedback-bg, linear-gradient(135deg, #4fcf70 0%, #36b37e 100%))',
        color: '#fff',
        borderRadius: '50%',
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        boxShadow: 'var(--success-feedback-shadow, 0 2px 16px rgb(0 0 0 / 12%))',
      }}
    >
      <span role="img" aria-label="success">
        ✔
      </span>
    </div>
  );
};

export default SaveSuccessToast;
