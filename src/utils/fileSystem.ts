import axios from 'axios';

interface AskResponse {
  response: string;
  codeExecuted?: boolean;
  executionResult?: string;
  filename?: string;
}
interface PythonExecutionResponse {
  output: string;
  error?: string;
  exitCode: number;
  waitingForInput: boolean;
  processId?: string; 
}
class FileSystem {
  async listDirectory(path: string = '.'): Promise<string> {
    try {
      const response = await axios.get('/api/fs/ls', {
        params: { path }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to list directory');
      }
      throw error;
    }
  }

  async changeDirectory(current: string, target: string): Promise<string> {
    try {
      const response = await axios.get('/api/fs/cd', {
        params: { current, target }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to change directory');
      }
      throw error;
    }
  }

  async makeDirectory(path: string): Promise<string> {
    try {
      const response = await axios.post('/api/fs/mkdir', { path });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to create directory');
      }
      throw error;
    }
  }

  async removeItem(path: string, recursive: boolean = false): Promise<string> {
    try {
      const response = await axios.delete('/api/fs/rm', {
        data: { path, recursive }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to remove item');
      }
      throw error;
    }
  }

  async touchFile(path: string): Promise<string> {
    try {
      const response = await axios.post('/api/fs/touch', { path });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to touch file');
      }
      throw error;
    }
  }

  async readFile(path: string): Promise<string> {
    try {
      const response = await axios.get('/api/fs/cat', {
        params: { path }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to read file');
      }
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<string> {
    try {
      const response = await axios.post('/api/fs/write', {
        path,
        content
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to write file');
      }
      throw error;
    }
  }

  async createAndExecuteCode(language: string, description: string, currentDirectory: string): Promise<string> {
    try {
      const response = await axios.post('/api/fs/code', {
        language,
        description,
        directory: currentDirectory
      });
  
      const { filename, code, output } = response.data;
      return `File created: ${filename}\n\nCode:\n${code}\n\nExecution Output:\n${output}`;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to execute code');
      }
      throw error;
    }
  }

  async ask(question: string, currentDirectory: string): Promise<string> {
    try {
      const response = await axios.post<AskResponse>('/api/fs/ask', {
        question,
        directory: currentDirectory
      });

      if (response.data.codeExecuted) {
        return `${response.data.response}\n\nFile created: ${response.data.filename}\nExecution Result:\n${response.data.executionResult}`;
      }

      return response.data.response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to process question');
      }
      throw error;
    }
  }
  async executePythonFile(
    filename: string,
    currentDirectory: string,
    input?: string
  ): Promise<{ output: string; error?: string; fixed?: boolean }> {
    try {
      const response = await axios.post('/api/fs/python', {
        filename,
        directory: currentDirectory,
        input
      });
      
      return {
        output: response.data.output,
        error: response.data.error,
        fixed: response.data.fixed
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Failed to execute Python file');
      }
      throw error;
    }
  }
}
export const fileSystem = new FileSystem();