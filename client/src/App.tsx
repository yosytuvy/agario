import GameCanvas from './components/GameCanvas';
import './App.css';

function App() {
  return (
    <div className="App">
      {/* full‐screen agar.io core loop */}
      <GameCanvas />
    </div>
  );
}

export default App;
