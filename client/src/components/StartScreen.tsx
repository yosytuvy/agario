// client/src/components/StartScreen.tsx - OPTIMIZED VERSION
import React from 'react';

interface StartScreenProps {
  onStartGame: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStartGame }) => {
  return (
    <div style={overlayStyle}>
      <div style={contentStyle}>
        <h1 style={titleStyle}>Agario</h1>
        <button 
          style={buttonStyle} 
          onClick={onStartGame}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(52, 152, 219, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(52, 152, 219, 0.3)';
          }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
};

// Inline styles for better performance (no CSS file loading)
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(50, 50, 50, 0.85)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const contentStyle: React.CSSProperties = {
  textAlign: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  padding: '60px 80px',
  borderRadius: '20px',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
  border: '2px solid rgba(255, 255, 255, 0.3)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '4rem',
  fontWeight: 'bold',
  color: '#2c3e50',
  margin: '0 0 40px 0',
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)',
  fontFamily: 'Arial, sans-serif',
  letterSpacing: '2px',
};

const buttonStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 'bold',
  padding: '15px 40px',
  background: 'linear-gradient(45deg, #3498db, #2980b9)',
  color: 'white',
  border: 'none',
  borderRadius: '50px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 15px rgba(52, 152, 219, 0.3)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  transform: 'translateY(0)',
};

export default StartScreen;