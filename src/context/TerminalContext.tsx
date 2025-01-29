import React, { createContext, useContext, useState } from 'react';
import { executeCommand as execCmd } from '../utils/commandExecutor';

interface HistoryEntry {
  command: string;
  output?: string;
  directory?: string;
}

interface TerminalContextType {
  history: HistoryEntry[];
  currentDirectory: string;
  executeCommand: (command: string) => Promise<void>;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentDirectory, setCurrentDirectory] = useState('/');

  const executeCommand = async (command: string) => {
    try {
      const result = await execCmd(command, currentDirectory);
      
      setHistory(prev => [...prev, { 
        command, 
        output: result.output,
        directory: currentDirectory
      }]);

      if (result.newDirectory) {
        setCurrentDirectory(result.newDirectory);
      }
    } catch (error) {
      setHistory(prev => [...prev, { 
        command, 
        output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        directory: currentDirectory
      }]);
    }
  };

  return (
    <TerminalContext.Provider value={{ history, currentDirectory, executeCommand }}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
};