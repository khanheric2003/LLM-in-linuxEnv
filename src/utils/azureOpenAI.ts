// File: src/utils/azureOpenAI.ts
import axios from 'axios';

interface AzureOpenAIConfig {
  endpoint: string;
  deploymentId: string;
  apiKey: string;
  apiVersion: string;
}

class AzureOpenAIService {
  private config: AzureOpenAIConfig;

  constructor(config: AzureOpenAIConfig) {
    this.config = config;
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.config.endpoint}/openai/deployments/${this.config.deploymentId}/chat/completions?api-version=${this.config.apiVersion}`,
        {
          messages: [
            { role: 'system', content: 'You are a helpful terminal assistant with access to the file system and development environment. You can help with file operations, coding, and development tasks.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 800,
          temperature: 0.7,
          frequency_penalty: 0,
          presence_penalty: 0,
          top_p: 0.95
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.config.apiKey,
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Azure OpenAI Error:', error);
      return 'Error processing your request. Please check the Azure OpenAI configuration and try again.';
    }
  }
}

// Initialize the service with your Azure OpenAI configuration
export const azureOpenAI = new AzureOpenAIService({
  endpoint: process.env.VITE_AZURE_OPENAI_ENDPOINT || '',
  deploymentId: process.env.VITE_AZURE_OPENAI_DEPLOYMENT_ID || '',
  apiKey: process.env.VITE_AZURE_OPENAI_API_KEY || '',
  apiVersion: process.env.VITE_AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
});

// File: src/utils/fileSystem.ts
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class FileSystemService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private resolvePath(relativePath: string): string {
    const normalizedPath = path.normalize(relativePath);
    const resolvedPath = path.resolve(this.basePath, normalizedPath);
    
    // Security check to prevent directory traversal
    if (!resolvedPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Attempted to access path outside of base directory');
    }
    
    return resolvedPath;
  }

  async listDirectory(dirPath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(dirPath);
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      const output = items.map(item => {
        const suffix = item.isDirectory() ? '/' : '';
        return item.name + suffix;
      });
      
      return output.join('\n');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return `Error listing directory: ${errorMessage}`;
    }
  }

  async createDirectory(dirPath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(dirPath);
      await fs.mkdir(fullPath, { recursive: true });
      return `Directory created: ${dirPath}`;
    } catch (error) {
      return `Error creating directory: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    }
  }

  async createFile(filePath: string, content: string = ''): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.writeFile(fullPath, content);
      return `File created: ${filePath}`;
    } catch (error) {
      return `Error creating file: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    }
  }

  async executeCommand(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.basePath,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      return stdout || stderr;
    } catch (error) {
      return `Error executing command: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    }
  }
}

// Initialize the file system service with the project root
export const fileSystem = new FileSystemService(process.cwd());