import { useEffect } from 'react';

function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    // Hilang otomatis setelah 5 detik
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  let bgColor = '#2196F3'; // Default: Biru (Info)
  let icon = 'ℹ️';
  let title = 'Info';
  
  if (type === 'outbid') {
      bgColor = '#ff4444'; // Merah
      icon = '⚠️';
      title = 'Outbid Alert';
  } else if (type === 'info') {
      bgColor = '#ff9800'; // Oranye (Peringatan Waktu)
      icon = '⏳';
      title = 'Reminder';
  } else if (type === 'success') {
      bgColor = '#4caf50'; // Hijau (Menang)
      icon = '🎉';
      title = 'Success';
  }
return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: bgColor,
      color: 'white',
      padding: '15px 25px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideIn 0.3s ease-out',
      maxWidth: '300px'
    }}>
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <div>
        <strong style={{ display: 'block', fontSize: '14px', marginBottom: '2px' }}>{title}</strong>
        <span style={{ fontSize: '13px', lineHeight: '1.4' }}>{message}</span>
      </div>
      <button 
        onClick={onClose}
        style={{ 
            background: 'none', border: 'none', color: 'white', 
            fontSize: '18px', cursor: 'pointer', marginLeft: 'auto',
            opacity: 0.8
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default Toast;