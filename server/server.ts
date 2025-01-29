import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Check if GEMINI_API_KEY exists
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in environment variables');
}

// Log that we have the key (don't log the actual key)
console.log('GEMINI_API_KEY status:', process.env.GEMINI_API_KEY ? 'Found' : 'Not Found');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

const BASE_PATH = path.resolve(__dirname, 'linux_environment');

// Define interfaces
interface MkdirRequest {
  path: string;
}

interface ExecuteRequest {
  filename: string;
  content: string;
  type: string;
}

type CommandType = 'python' | 'javascript' | 'typescript' | 'shell' | 'bash';

const COMMAND_MAP: Record<CommandType, string> = {
  'python': 'python',
  'javascript': 'node',
  'typescript': 'ts-node',
  'shell': 'sh',
  'bash': 'bash'
};

app.use(express.json());

// Initialize environment
app.post('/api/fs/init', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BASE_PATH)) {
      fs.mkdirSync(BASE_PATH, { recursive: true });
      
      const directories = [
        'home',
        'home/user',
        'home/user/documents',
        'home/user/downloads',
        'bin',
        'etc',
        'usr',
        'usr/bin',
        'usr/local',
        'var',
        'tmp'
      ];

      directories.forEach(dir => {
        fs.mkdirSync(path.join(BASE_PATH, dir), { recursive: true });
      });

      fs.writeFileSync(
        path.join(BASE_PATH, 'home', 'user', '.bashrc'),
        '# .bashrc'
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ error: 'Failed to initialize environment' });
  }
});

// Make directory
app.post('/api/fs/mkdir', (req: Request, res: Response) => {
  try {
    const dirPath = req.body.path;
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const fullPath = path.join(BASE_PATH, dirPath);
    
    // Security check
    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Directory already exists' });
    }
  } catch (error) {
    console.error('Mkdir error:', error);
    res.status(500).json({ error: 'Failed to create directory' });
  }
});

// List directory contents
app.get('/api/fs/ls', (req: Request, res: Response) => {
  try {
    const requestedPath = (req.query.path as string) || '.';
    const fullPath = path.join(BASE_PATH, requestedPath);

    if (!fullPath.startsWith(BASE_PATH)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: `Directory not found: ${requestedPath}` });
    }

    const items = fs.readdirSync(fullPath);
    const details = items.map(item => {
      const itemPath = path.join(fullPath, item);
      const stats = fs.statSync(itemPath);
      const type = stats.isDirectory() ? 'd' : '-';
      return `${type} ${item}${stats.isDirectory() ? '/' : ''}`;
    });

    res.json(details.join('\n') || 'Empty directory');
  } catch (error) {
    console.error('LS error:', error);
    res.status(500).json({ error: 'Failed to list directory' });
  }
});

// Change directory
app.get('/api/fs/cd', (req: Request, res: Response) => {
  try {
    const current = req.query.current as string;
    const target = req.query.target as string;
    let newPath = target || '/';

    if (target === '~') {
      newPath = '/home/user';
    } else if (target === '..') {
      const currentPath = current || '/';
      newPath = path.dirname(currentPath);
    } else if (target?.startsWith('/')) {
      newPath = target;
    } else if (current && target) {
      newPath = path.join(current, target);
    }

    newPath = path.normalize(newPath).replace(/\\/g, '/');
    const fullPath = path.join(BASE_PATH, newPath);

    if (!fs.existsSync(fullPath)) {
      return res.json(current);
    }

    if (!fs.statSync(fullPath).isDirectory()) {
      return res.json(current);
    }

    res.json(newPath);
  } catch (error) {
    console.error('CD error:', error);
    res.status(500).json({ error: 'Failed to change directory' });
  }
});

// Execute file
app.post('/api/fs/execute', async (req: Request<any, any, ExecuteRequest>, res: Response) => {
    const { filename, content, type } = req.body;
    
    if (!isValidCommandType(type)) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }
  
    try {
      const filePath = path.join(BASE_PATH, 'home', 'user', filename);
      fs.writeFileSync(filePath, content);
  
      if (type === 'python' || type === 'shell' || type === 'bash') {
        fs.chmodSync(filePath, '755');
      }
  
      const output = await executeFile(filePath, type);
      res.json(output);
    } catch (error) {
      console.error('Execute error:', error);
      res.status(500).json({ error: `Failed to execute file: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

function isValidCommandType(type: unknown): type is CommandType {
  return typeof type === 'string' && type in COMMAND_MAP;
}

// Start server
app.listen(PORT, () => {
  if (!fs.existsSync(BASE_PATH)) {
    fs.mkdirSync(BASE_PATH, { recursive: true });
  }
  console.log(`Server running on port ${PORT}`);
  console.log(`Linux environment initialized at: ${BASE_PATH}`);
});

// ask llm
app.post('/api/fs/ask', async (req: Request, res: Response) => {
    try {
      const { question, directory } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY not found in environment');
        return res.status(500).json({
          error: 'API configuration error. Please contact the administrator.'
        });
      }
  
      const API_KEY = process.env.GEMINI_API_KEY;
      // Using gemini-1.5-flash model as specified in the curl example
      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Current directory: ${directory}. Question: ${question}`
              }]
            }],
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE"
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800,
            }
          })
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to get response from Gemini API');
        }
  
        const data = await response.json();
        console.log('Gemini API response:', data); // Debug log
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
          const answer = data.candidates[0].content.parts[0].text;
          res.json({ response: answer });
        } else {
          throw new Error('Unexpected API response structure');
        }
      } catch (error) {
        console.error('LLM error:', error);
        res.status(500).json({
          error: `LLM error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('Ask endpoint error:', error);
      res.status(500).json({
        error: `Failed to process question: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

app.post('/api/fs/code', async (req: Request, res: Response) => {
    try {
      const { language, description, directory } = req.body;
      const result = await handleCodeCommand(language, description, directory);
      res.json(result);
    } catch (error) {
      console.error('Code execution error:', error);
      res.status(500).json({
        error: `Failed to execute code: ${error}`
      });
    }
  });
//   seperate from command
async function handleCodeCommand(language: string, description: string, currentDirectory: string) {
    const API_KEY = process.env.GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
    const prompt = `Create a ${language} program that does: ${description}
  Please respond ONLY with code in this exact format:
  FILENAME: [filename]
  CODE:
  \`\`\`${language}
  [your code here]
  \`\`\`
  EXECUTE: [command to run the code]
  
  Do not include any explanations or additional text.`;
  
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
        }
      })
    });
  
    const data = await response.json();
    const answer = data.candidates[0].content.parts[0].text;
  
    // Extract filename, code, and execute command
    const filenameMatch = answer.match(/FILENAME: (.+)/);
    const codeMatch = answer.match(/```[\w\n]+([\s\S]+?)```/);
    const executeMatch = answer.match(/EXECUTE: (.+)/);
  
    if (!filenameMatch || !codeMatch || !executeMatch) {
      throw new Error('Invalid response format from API');
    }
  
    const filename = filenameMatch[1].trim();
    const code = codeMatch[1].trim();
    const executeCommand = executeMatch[1].trim();
  
    // Create the file
    const filePath = path.join(BASE_PATH, currentDirectory, filename);
    fs.writeFileSync(filePath, code);
  
    // Execute the file
    try {
      const { stdout, stderr } = await execAsync(executeCommand, {
        cwd: path.join(BASE_PATH, currentDirectory)
      });
  
      return {
        filename,
        code,
        output: stderr ? `Warning: ${stderr}\nOutput: ${stdout}` : stdout
      };
    } catch (error) {
      throw new Error(`Execution error: ${error}`);
    }
  }

  async function executeFile(filePath: string, type: string): Promise<string> {
    const commands: { [key: string]: string } = {
      'python': 'python',  // or 'python3' depending on your system
      'javascript': 'node',
      'typescript': 'ts-node',
      'shell': 'sh',
      'bash': 'bash'
    };
  
    const command = commands[type.toLowerCase()];
    if (!command) {
      throw new Error(`Unsupported file type: ${type}`);
    }
  
    try {
      // Check for Python specifically
      if (type === 'python') {
        try {
          await execAsync('python --version');
        } catch (error) {
          try {
            await execAsync('python3 --version');
            commands['python'] = 'python3'; // Use python3 if python doesn't exist
          } catch (error) {
            throw new Error('Python is not installed or not in PATH');
          }
        }
      }
  
      const { stdout, stderr } = await execAsync(`${commands[type]} "${filePath}"`, {
        cwd: path.dirname(filePath)
      });
  
      return stderr ? `Warning: ${stderr}\nOutput: ${stdout}` : stdout;
    } catch (error) {
      throw new Error(`Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
// Add this endpoint to your server.ts
app.get('/api/fs/cat', (req: Request, res: Response) => {
    try {
      const filePath = (req.query.path as string);
      if (!filePath) {
        return res.status(400).json({ error: 'Path is required' });
      }
  
      const fullPath = path.join(BASE_PATH, filePath);
      
      // Security check
      if (!fullPath.startsWith(BASE_PATH)) {
        return res.status(403).json({ error: 'Access denied' });
      }
  
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }
  
      if (!fs.statSync(fullPath).isFile()) {
        return res.status(400).json({ error: 'Not a file' });
      }
  
      const content = fs.readFileSync(fullPath, 'utf8');
      res.json(content);
    } catch (error) {
      console.error('Cat error:', error);
      res.status(500).json({ error: 'Failed to read file' });
    }
  });