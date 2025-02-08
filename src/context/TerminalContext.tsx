import React, { createContext, useContext, useState } from 'react';
import { executeCommand as execCmd } from '../utils/commandExecutor';

interface HistoryEntry {
  command: string;
  output?: string;
  directory?: string;
  awaitingInput?: boolean;
  context?: {
    command: string;
    file: string;
    previousOutput: string;
  };
}

interface TerminalContextType {
  history: HistoryEntry[];
  currentDirectory: string;
  executeCommand: (command: string) => Promise<void>;
  isAwaitingInput: boolean;
  handleInput: (input: string) => Promise<void>;
  lastContext: HistoryEntry['context'] | null;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentDirectory, setCurrentDirectory] = useState('/');
  const [isAwaitingInput, setIsAwaitingInput] = useState(false);
  const [lastContext, setLastContext] = useState<HistoryEntry['context'] | null>(null);

  const executeCommand = async (command: string) => {
    try {
      console.log('Executing command:', command);
      const result = await execCmd(command, currentDirectory);
      console.log('Command result:', result);
      
      // Update history with the command first
      setHistory(prev => [...prev, {
        command,
        output: result.output,
        directory: currentDirectory,
        awaitingInput: result.awaitingInput,
        context: result.context
      }]);

      // Update directory if changed
      if (result.newDirectory) {
        setCurrentDirectory(result.newDirectory);
      }

      // Handle input state
      console.log('Setting isAwaitingInput to:', result.awaitingInput);
      setIsAwaitingInput(Boolean(result.awaitingInput));
      if (result.awaitingInput) {
        console.log('Setting lastContext to:', result.context);
        setLastContext(result.context || null);
      }

    } catch (error) {
      console.error('Command execution error:', error);
      setHistory(prev => [...prev, {
        command,
        output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        directory: currentDirectory
      }]);
      setIsAwaitingInput(false);
      setLastContext(null);
    }
  };

  const handleInput = async (input: string) => {
    if (!lastContext) {
      console.warn('No lastContext available for input');
      return;
    }

    try {
      console.log('Handling input:', input);
      // Execute the command with input
      const command = `${lastContext.command} ${lastContext.file} ${input}`;
      await executeCommand(command);
      
    } catch (error) {
      console.error('Input handling error:', error);
      setHistory(prev => [...prev, {
        command: 'input',
        output: `Error processing input: ${error instanceof Error ? error.message : 'Unknown error'}`,
        directory: currentDirectory
      }]);
      setIsAwaitingInput(false);
      setLastContext(null);
    }
  };

  console.log('Current state:', { isAwaitingInput, lastContext });

  return (
    <TerminalContext.Provider 
      value={{ 
        history, 
        currentDirectory, 
        executeCommand, 
        isAwaitingInput,
        handleInput,
        lastContext
      }}
    >
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