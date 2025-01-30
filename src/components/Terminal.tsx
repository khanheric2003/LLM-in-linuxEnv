import React, { useState, useRef, useEffect } from 'react';
import { useTerminal } from '../context/TerminalContext';

const Terminal: React.FC = () => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const { history, currentDirectory, executeCommand } = useTerminal();

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      await executeCommand(input);
    } catch (error) {
      console.error('Command execution error:', error);
    }
    setIsProcessing(false);
    setInput('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="flex w-full gap-4 p-4 h-full">
      {/* Left Terminal */}
      <div 
        className="flex-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden"
        onClick={handleClick}
      >
        <div className="flex items-center px-4 py-2 bg-gray-700">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="ml-4 text-sm text-gray-400">Terminal</div>
        </div>

        <div
          ref={terminalRef}
          className="h-[calc(100vh-8rem)] overflow-y-auto p-4 font-mono text-sm"
        >
          {history.map((entry, index) => (
            <div key={index} className="mb-2">
              <div className="flex items-center">
                <span className="text-green-400">user@terminal:</span>
                <span className="text-blue-400">~{entry.directory || currentDirectory}</span>
                <span className="text-gray-400">$ </span>
                <span className="ml-2">{entry.command}</span>
              </div>
            </div>
          ))}

          <div className="flex items-center">
            <span className="text-green-400">user@terminal:</span>
            <span className="text-blue-400">~{currentDirectory}</span>
            <span className="text-gray-400">$ </span>
            <form onSubmit={handleSubmit} className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full ml-2 bg-transparent outline-none text-gray-100"
                autoFocus
                disabled={isProcessing}
              />
            </form>
          </div>
        </div>
      </div>

      {/* Right Output Panel */}
      <div className="flex-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center px-4 py-2 bg-gray-700">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="ml-4 text-sm text-gray-400">Output</div>
        </div>

        <div
          ref={outputRef}
          className="h-[calc(100vh-8rem)] overflow-y-auto p-4 font-mono text-sm"
        >
          {history.map((entry, index) => (
            entry.output && (
              <div key={index} className="mb-4">
                <div className="text-blue-400 mb-1">$ {entry.command}</div>
                <div className="whitespace-pre-wrap text-gray-300 bg-gray-900 p-3 rounded">
                  {entry.output}
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default Terminal;