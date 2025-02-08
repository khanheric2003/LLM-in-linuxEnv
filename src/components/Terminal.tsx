import React, { useState, useRef, useEffect } from 'react';
import { useTerminal } from '../context/TerminalContext';

const Terminal: React.FC = () => {
  const [input, setInput] = useState('');
  const [programInput, setProgramInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const programInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const { 
    history, 
    currentDirectory, 
    executeCommand, 
    isAwaitingInput, 
    handleInput,
    lastContext 
  } = useTerminal();

  // Scroll to bottom when history updates
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Focus management
  const maintainFocus = () => {
    if (isAwaitingInput) {
      programInputRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  };

  // Handle initial focus and focus changes
  useEffect(() => {
    maintainFocus();
  }, [isAwaitingInput]);

  // Click handler to maintain focus
  const handleClick = () => {
    maintainFocus();
  };

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
    // Maintain focus after command execution
    setTimeout(maintainFocus, 0);
  };

  const handleProgramInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programInput.trim() || isProcessing || !isAwaitingInput) return;

    setIsProcessing(true);
    try {
      await handleInput(programInput);
    } catch (error) {
      console.error('Program input error:', error);
    }
    setIsProcessing(false);
    setProgramInput('');
    // Maintain focus after program input
    setTimeout(maintainFocus, 0);
  };

  return (
    <div className="flex flex-col w-full gap-4 p-4 h-full" onClick={handleClick}>
      <div className="flex gap-4 flex-1">
        {/* Main Terminal */}
        <div className="flex-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
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
            className="h-[calc(80vh-8rem)] overflow-y-auto p-4 font-mono text-sm"
          >
            {history.map((entry, index) => (
              <div key={index} className="mb-2">
                <div className="flex items-start flex-wrap">
                  <span className="text-green-400 whitespace-nowrap">user@terminal:</span>
                  <span className="text-blue-400 whitespace-nowrap">~{entry.directory || currentDirectory}</span>
                  <span className="text-gray-400 whitespace-nowrap">$ </span>
                  <span className="ml-2 text-gray-300 break-all">{entry.command}</span>
                </div>
              </div>
            ))}

            <div className="flex items-start flex-wrap">
              <span className="text-green-400 whitespace-nowrap">user@terminal:</span>
              <span className="text-blue-400 whitespace-nowrap">~{currentDirectory}</span>
              <span className="text-gray-400 whitespace-nowrap">$ </span>
              <form onSubmit={handleSubmit} className="flex-1 min-w-[200px]">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full ml-2 bg-transparent outline-none text-gray-100 break-all"
                  disabled={isProcessing || isAwaitingInput}
                  autoComplete="off"
                  spellCheck="false"
                />
              </form>
            </div>
          </div>
        </div>

        {/* Output Panel */}
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
            className="h-[calc(80vh-8rem)] overflow-y-auto p-4 font-mono text-sm"
          >
            {history.map((entry, index) => (
              <div key={index} className="mb-4">
                <div className="text-blue-400 mb-1 break-all">$ {entry.command}</div>
                {entry.output && (
                  <div className="whitespace-pre-wrap text-gray-300 bg-gray-900 p-3 rounded break-all">
                    {entry.output}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Program Input Terminal */}
      <div className="flex-none h-40 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center px-4 py-2 bg-gray-700">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="ml-4 text-sm text-gray-400">Program Input</div>
          {isAwaitingInput && <div className="ml-2 text-yellow-400">(Waiting for input)</div>}
        </div>

        <div className="p-4 font-mono text-sm">
          <form onSubmit={handleProgramInput} className="flex items-start flex-wrap">
            <span className="text-green-400 mr-2 whitespace-nowrap">&gt;</span>
            <input
              ref={programInputRef}
              type="text"
              value={programInput}
              onChange={(e) => setProgramInput(e.target.value)}
              className={`flex-1 min-w-[200px] bg-transparent outline-none break-all ${
                isAwaitingInput ? 'text-gray-100' : 'text-gray-500'
              }`}
              disabled={!isAwaitingInput || isProcessing}
              placeholder={isAwaitingInput ? "Enter your input..." : "No input required"}
              autoComplete="off"
              spellCheck="false"
            />
          </form>
          {isAwaitingInput && (
            <div className="text-yellow-400 mt-2 text-sm">
              Program is waiting for input. Enter your response above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Terminal;