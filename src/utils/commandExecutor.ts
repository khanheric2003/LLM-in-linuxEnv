import { fileSystem } from './fileSystem';
import { processLLMCommand } from './llmIntegration';

interface CommandResult {
  output?: string;
  newDirectory?: string;
}

export const executeCommand = async (command: string, currentDirectory: string): Promise<CommandResult> => {
  const args = command.trim().split(/\s+/);
  const cmd = args[0];

  try {
    switch (cmd) {
      case 'ls':
        const path = args[1] || currentDirectory;
        try {
          const listing = await fileSystem.listDirectory(path);
          return { output: listing };
        } catch (error) {
          return { output: `ls: cannot access '${path}': ${error instanceof Error ? error.message : 'Unknown error'}` };
        }

      case 'cd':
        const newPath = args[1] || '/';
        try {
          const newDir = await fileSystem.changeDirectory(currentDirectory, newPath);
          return { newDirectory: newDir };
        } catch (error) {
          return { output: `cd: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }

      case 'pwd':
        return { output: currentDirectory };

      case 'mkdir':
        if (args.length < 2) {
          return { output: 'mkdir: missing operand' };
        }
        try {
          await fileSystem.makeDirectory(args[1]);
          return { output: `Created directory: ${args[1]}` };
        } catch (error) {
          return { output: `mkdir: cannot create directory '${args[1]}': ${error instanceof Error ? error.message : 'Unknown error'}` };
        }

      case 'rm':
        if (args.length < 2) {
          return { output: 'rm: missing operand' };
        }
        const isRecursive = args.includes('-r') || args.includes('-R');
        const target = args[args.length - 1];
        try {
          await fileSystem.removeItem(target, isRecursive);
          return { output: `Removed: ${target}` };
        } catch (error) {
          return { output: `rm: cannot remove '${target}': ${error instanceof Error ? error.message : 'Unknown error'}` };
        }

      case 'touch':
        if (args.length < 2) {
          return { output: 'touch: missing file operand' };
        }
        try {
          await fileSystem.touchFile(args[1]);
          return { output: '' };
        } catch (error) {
          return { output: `touch: cannot touch '${args[1]}': ${error instanceof Error ? error.message : 'Unknown error'}` };
        }

      case 'cat':
        if (args.length < 2) {
          return { output: 'cat: missing file operand' };
        }
        try {
          const content = await fileSystem.readFile(args[1]);
          return { output: content };
        } catch (error) {
          return { output: `cat: ${args[1]}: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }

      case 'echo':
        const text = args.slice(1).join(' ');
        if (args.includes('>')) {
          const outputIndex = args.indexOf('>');
          const content = args.slice(1, outputIndex).join(' ');
          const file = args[outputIndex + 1];
          if (!file) {
            return { output: 'echo: syntax error: unexpected end of file' };
          }
          try {
            await fileSystem.writeFile(file, content);
            return { output: '' };
          } catch (error) {
            return { output: `echo: ${error instanceof Error ? error.message : 'Unknown error'}` };
          }
        }
        return { output: text };

      case 'help':
        return {
          output: `Available commands:
  ls [path] - List directory contents
  cd [path] - Change directory
  pwd - Print working directory
  mkdir [path] - Create directory
  rm [-r] [path] - Remove file or directory
  touch [file] - Create empty file or update timestamp
  cat [file] - Display file contents
  echo [text] - Display text
  echo [text] > [file] - Write text to file
  clear - Clear terminal
  ask [question] - Ask the LLM a question
  code [language] [description] - Generate and execute code`
        };

      case 'clear':
        return {};

      // Update the 'code' case in your switch statement
      case 'code':
        const language = args[1]?.toLowerCase() || 'python';
        const description = args.slice(2).join(' ');
        
        if (!description) {
          return { 
            output: `Usage: code [language] [description]
      Examples:
        code python print hello world
        code javascript create a fibonacci function
        code typescript make a simple calculator`
          };
        }

        try {
          const response = await fileSystem.createAndExecuteCode(language, description, currentDirectory);
          return { output: response };
        } catch (error) {
          return { 
            output: `Error: ${error instanceof Error ? error.message : 'Failed to execute code'}`
          };
        }

      case 'ask':
        const question = args.slice(1).join(' ');
        if (!question) {
          return { output: 'Error: Please provide a question' };
        }

        try {
          const response = await fileSystem.ask(question, currentDirectory);
          return { output: response };
        } catch (error) {
          return { 
            output: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
          };
        }

      default:
        return {
          output: `Command not found: ${cmd}. Type 'help' for available commands.`
        };
    }
  } catch (error) {
    return {
      output: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};