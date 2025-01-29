import React from 'react';
import Terminal from './components/Terminal';
import { TerminalProvider } from './context/TerminalContext';

const App: React.FC = () => {
  return (
    <TerminalProvider>
      <div className="h-screen w-screen bg-gray-900 text-gray-100 overflow-hidden">
        <Terminal />
      </div>
    </TerminalProvider>
  );
};

export default App;