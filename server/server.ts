import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

import { identifyAndHandleQuery, getAvailableCategories, weatherHandler, stockHandler } from './handlers';
import { QueryResponse, QuestionContext } from './types/type';
// langchain
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";


// nlp
import nlp from 'compromise';

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
let previousContext: QuestionContext | null = null;


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


interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; 
  timezone: string;
}

interface WeatherStats {
  date: string;
  maxTemp: string;
  minTemp: string;
  avgTemp: string;
  location: string;
  timezone: string;
}
type CommandType = 'python' | 'javascript' | 'typescript' | 'shell' | 'bash';

const COMMAND_MAP: Record<CommandType, string> = {
  'python': 'python',
  'javascript': 'node',
  'typescript': 'ts-node',
  'shell': 'sh',
  'bash': 'bash'
};

// Store active Python processes
const activeProcesses = new Map();

interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
  waitingForInput: boolean;
}
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
async function identifyQuestionCategory(question: string, API_KEY: string): Promise<string> {
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
  
  const categoryPrompt = `Identify the category of this question from these options only: WEATHER, STOCK, GENERAL. 
  Only respond with one word (the category).
  Question: "${question}"
  Category:`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: categoryPrompt }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10,
      }
    })
  });

  const data = await response.json();
  const category = data.candidates[0].content.parts[0].text.trim().toUpperCase();
  return category;
}

app.post('/api/fs/ask', async (req: Request, res: Response) => {
  try {
    const { question, directory } = req.body;
    let processedQuestion = question;
    console.log('Original question:', question);

    // Extract context from current question
    const currentContext = extractContext(question);
    console.log('Current context:', currentContext);

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in environment');
      return res.status(500).json({
        error: 'API configuration error. Please contact the administrator.'
      });
    }

    const API_KEY = process.env.GEMINI_API_KEY;

    // Get category from LLM
    console.log('Identifying question category...');
    const category = await identifyQuestionCategory(processedQuestion, API_KEY);
    console.log('Identified category:', category);

    // Update context with category
    currentContext.category = category;
    
    // Check if it's a follow-up question
    if (isFollowUpQuestion(question) && previousContext?.subject) {
      processedQuestion = question.replace(
        /(it|this|that|they|these|those)/i,
        previousContext.subject
      );
      console.log('Processed follow-up question:', processedQuestion);
    }

    // Store current context for next question
    previousContext = currentContext;

    // Handle based on category
    switch (category) {
      case 'STOCK': {
        try {
          console.log('Attempting to handle stock query...');
          const stockResponse = await stockHandler.handle(processedQuestion);
          if (stockResponse) {
            console.log('Stock handler response:', stockResponse);
            return res.json({
              response: stockResponse,
              category: 'Stock Market'
            });
          }
          console.log('Stock handler returned null');
        } catch (error) {
          console.error('Stock handler error:', error);
        }
        break;
      }

      case 'WEATHER': {
        try {
          const weatherResponse = await weatherHandler.handle(processedQuestion);
          if (weatherResponse) {
            return res.json({
              response: weatherResponse,
              category: 'Weather'
            });
          }
        } catch (error) {
          console.error('Weather handler error:', error);
        }
        break;
      }
    }

    // Only reach here if handlers didn't respond
    console.log('No handler response, falling back to LLM');

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Current directory: ${directory}. Question: ${processedQuestion}`
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
    console.log('Gemini API response:', data);

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const answer = data.candidates[0].content.parts[0].text;
      return res.json({
        response: answer,
        category: 'General'
      });
    } else {
      throw new Error('Unexpected API response structure');
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
    
    // Remove the hyphen from language if present
    const cleanLanguage = language.replace(/^-/, '');
    
    console.log('Code generation request:', {
      language: cleanLanguage,
      description,
      directory
    });

    const result = await handleCodeCommand(cleanLanguage, description, directory);
    console.log('Code generation successful');
    res.json(result);
  } catch (error) {
    console.error('Code execution error:', error);
    res.status(500).json({
      error: `Failed to execute code: ${error}`
    });
  }
});
  
async function handleCodeCommand(language: string, description: string, currentDirectory: string) {
  // Validate inputs
  if (!language) {
    throw new Error('Language must be specified');
  }
  if (!description) {
    throw new Error('Description must be provided');
  }

  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY!,
    modelName: "gemini-pro",
    maxOutputTokens: 2048,
    temperature: 0.3
  });

  // Language-specific guidelines
  const languageGuidelines = {
    python: `
      Required practices for Python:
      - Use proper import statements at the top
      - Include error handling with try/except
      - Use type hints where appropriate
      - Follow PEP 8 style guide
      - Use proper string formatting (f-strings)
      - Handle file operations safely
    `,
    javascript: `
      Required practices for JavaScript:
      - Use proper import/require statements
      - Include error handling with try/catch
      - Use async/await for async operations
      - Follow ESLint standards
      - Use proper string templates
      - Handle promises appropriately
    `,
    typescript: `
      Required practices for TypeScript:
      - Use proper import statements
      - Include type definitions
      - Use interfaces where appropriate
      - Include error handling with try/catch
      - Follow TSLint standards
      - Use async/await for async operations
    `
  };

  // Create structured prompts
  const systemPrompt = new PromptTemplate({
    template: "You are an expert {language} programmer who writes clean, efficient, and well-documented code. You always include necessary imports and handle errors appropriately. Current environment: - Linux-based system - Python 3 for Python code - Node.js for JavaScript/TypeScript - All standard libraries available",
    inputVariables: ["language"]
  });

  const taskPrompt = new PromptTemplate({
    template: "Create a {language} program that does the following: {description}\n\nFollow these steps:\n1. Analyze required libraries and imports\n2. Plan the code structure\n3. Implement with proper error handling\n4. Test for completeness\n\nYour response MUST be in this exact format:\nFILENAME: [filename with extension]\nCODE:\n```{language}\n[complete code with imports]\n```\nEXECUTE: [just the command to run the code, no code blocks or formatting]",
    inputVariables: ["language", "description"]
  });

  try {
    // Create prompt parts
    const systemMessage = await systemPrompt.format({ language });
    const taskMessage = await taskPrompt.format({ language, description });
    const guidelines = languageGuidelines[language as keyof typeof languageGuidelines] || "";

    // Combine prompts
    const fullPrompt = `${systemMessage}\n\n${guidelines}\n\n${taskMessage}`;
    
    // Get response from model
    const response = await model.invoke(fullPrompt);
    const result = response.text;
    
    console.log("Raw LLM response:", result);

    // Improved parsing with better regex
    const filenameMatch = result.match(/FILENAME:\s*([^\n]+)/);
    const codeMatch = result.match(/```[\w\n]+([\s\S]+?)```/);
    const executeMatch = result.match(/EXECUTE:\s*(?:```(?:bash)?\n)?([^\n```]+)/);

    if (!filenameMatch || !codeMatch || !executeMatch) {
      console.error("Failed to parse LLM response:", { filenameMatch, codeMatch, executeMatch });
      throw new Error("Invalid response format from LLM");
    }

    const filename = filenameMatch[1].trim();
    const code = codeMatch[1].trim();
    // Clean up the execute command by removing any markdown formatting
    const executeCommand = executeMatch[1]
      .trim()
      .replace(/^```\w*\s*/, '')  // Remove opening code block
      .replace(/\s*```$/, '');    // Remove closing code block

    console.log('Parsed results:', {
      filename,
      executeCommand,
      codeLength: code.length
    });

    // Ensure directory exists
    const fullDirectoryPath = path.join(BASE_PATH, currentDirectory);
    if (!fs.existsSync(fullDirectoryPath)) {
      fs.mkdirSync(fullDirectoryPath, { recursive: true });
    }

    // Write and execute code
    const filePath = path.join(fullDirectoryPath, filename);
    fs.writeFileSync(filePath, code, { mode: 0o755 });

    console.log(`Executing command: ${executeCommand} in directory: ${fullDirectoryPath}`);
    
    // Execute the cleaned command
    const { stdout, stderr } = await execAsync(executeCommand, {
      cwd: fullDirectoryPath,
      shell: true  // This helps with command interpretation
    });

    return {
      filename,
      code,
      output: stderr ? `Warning: ${stderr}\nOutput: ${stdout}` : stdout
    };

  } catch (error) {
    if (error instanceof Error) {
      console.error("Code generation/execution error:", {
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
}
  export { handleCodeCommand };

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

  app.post('/api/fs/python', async (req: Request, res: Response) => {
    try {
      const { filename, directory, input } = req.body;
      
      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }
  
      const fullPath = path.join(BASE_PATH, directory, filename);
      
      // Security checks
      if (!fullPath.startsWith(BASE_PATH)) {
        return res.status(403).json({ error: 'Access denied' });
      }
  
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }
  
      const MAX_RETRIES = 3;
      let attempt = 1;
      let wasFixed = false;
  
      while (attempt <= MAX_RETRIES) {
        try {
          const executionResult = await new Promise<ExecutionResult>((resolve, reject) => {
            const pythonProcess = spawn('python', [fullPath], {
              cwd: path.dirname(fullPath)
            });
  
            let outputData = '';
            let errorData = '';
            let isWaitingForInput = false;
  
            pythonProcess.stdout.on('data', (data) => {
              const output = data.toString();
              outputData += output;
              console.log('Python output:', output);
              
              if (output.toLowerCase().includes('input') || 
                  output.endsWith('?') || 
                  output.endsWith(': ') ||
                  output.includes('Enter') ||
                  output.trim().endsWith('>')) {
                isWaitingForInput = true;
                console.log('Input detected, setting waitingForInput to true');
              }
            });
  
            pythonProcess.stderr.on('data', (data) => {
              errorData += data.toString();
            });
  
            pythonProcess.on('close', (code) => {
              console.log('Process closed. isWaitingForInput:', isWaitingForInput);
              if (code !== 0 && errorData && !isWaitingForInput) {
                reject(new Error(errorData));
              } else {
                resolve({
                  output: outputData,
                  error: errorData,
                  exitCode: code ?? 1,
                  waitingForInput: isWaitingForInput,
                  fixed: wasFixed
                });
              }
            });
  
            if (input) {
              pythonProcess.stdin.write(input + '\n');
              pythonProcess.stdin.end();
            }
          });
  
          // Transform ExecutionResult to PythonExecutionResponse
          const response: PythonExecutionResponse = {
            output: executionResult.output,
            error: executionResult.error || undefined,
            exitCode: executionResult.exitCode,
            waitingForInput: executionResult.waitingForInput,
            fixed: executionResult.fixed
          };
  
          console.log('Execution successful, sending response:', response);
          return res.json(response);
  
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.log(`Execution attempt ${attempt} failed:`, errorMessage);
  
          if (attempt < MAX_RETRIES) {
            console.log(`Attempting to fix code (attempt ${attempt})...`);
            try {
              await fixPythonCode(fullPath, errorMessage);
              wasFixed = true;
              attempt++;
              continue;
            } catch (fixError) {
              console.error('Failed to fix code:', fixError);
            }
          }
          
          if (attempt === MAX_RETRIES) {
            const response: PythonExecutionResponse = {
              output: `Failed to execute Python file after ${MAX_RETRIES} attempts.\nLast error: ${errorMessage}`,
              error: errorMessage,
              exitCode: 1,
              waitingForInput: false,
              fixed: false
            };
            return res.status(500).json(response);
          }
          
          attempt++;
        }
      }
    } catch (error) {
      console.error('Python execution error:', error);
      const response: PythonExecutionResponse = {
        output: '',
        error: `Failed to execute Python file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exitCode: 1,
        waitingForInput: false,
        fixed: false
      };
      res.status(500).json(response);
    }
  });
  
  // Add cleanup on server shutdown
  process.on('SIGTERM', () => {
    activeProcesses.forEach((process) => {
      process.kill();
    });
    activeProcesses.clear();
  });

// fix pyton code
// In server.ts
async function fixPythonCode(filePath: string, error: string): Promise<string> {
  try {
    const originalCode = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Analyze error type
    const errorType = {
      isNameError: error.includes('NameError'),
      isModuleError: error.includes('ModuleNotFoundError'),
      isSyntaxError: error.includes('SyntaxError'),
      isImportError: error.includes('ImportError') || error.includes('ModuleNotFoundError'),
      suggestedFix: error.includes('Did you mean:') ? 
        error.split('Did you mean:')[1].trim().replace('?', '') : null
    };

    console.log('Error analysis:', errorType);

    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY!,
      modelName: "gemini-pro",
      maxOutputTokens: 2048,
      temperature: 0.3
    });

    let fixPrompt = `Fix this Python code that produced an error. Pay special attention to imports.

Original code:
\`\`\`python
${originalCode}
\`\`\`

Error message:
${error}

Follow these rules for fixing the code:

1. Import Management:
   - Only import modules that are ACTUALLY USED in the code
   - Prefer standard library imports over external libraries
   - For basic operations (print, input, etc.), NO imports are needed
   - If using features like json, datetime, math, etc., MUST include the proper import
   - Remove any unused imports
   - Place all imports at the top of the file

2. Code Documentation:
   - Add a clear description comment block at the top explaining what the code does
   - List any special requirements or dependencies
   - Include "Fix attempt: [what was fixed]" in the comments

3. Error Fixing Strategy:
   - For simple typos (like 'pint' → 'print'), just fix the typo
   - For missing imports, add ONLY the necessary import
   - For undefined variables, check if they need to be defined or imported
   - Ensure all used functions/modules are properly imported

Provide ONLY the corrected code with documentation comments. No explanations outside the code.`;

    // Add contextual guidance based on error type
    if (errorType.isNameError && errorType.suggestedFix) {
      fixPrompt += `\nSpecific guidance: Consider using '${errorType.suggestedFix}' if it's just a typo.`;
    } else if (errorType.isImportError) {
      fixPrompt += `\nSpecific guidance: This appears to be an import-related error. Ensure all required modules are imported and are from the standard library when possible.`;
    }

    const response = await model.invoke(fixPrompt);
    const fixedCode = response.text
      .replace(/^```python\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    // Basic validation of the fixed code
    if (fixedCode.includes('import')) {
      // Check if the imports are actually used in the code
      const imports = fixedCode.match(/^import\s+(\w+)|^from\s+(\w+)\s+import/gm) || [];
      const codeBody = fixedCode.split('\n')
        .filter(line => !line.trim().startsWith('import') && !line.trim().startsWith('from'))
        .join('\n');
      
      for (const importStatement of imports) {
        const moduleName = importStatement.split(/\s+/)[1];
        if (!codeBody.includes(moduleName)) {
          console.log(`Warning: Potentially unnecessary import detected: ${moduleName}`);
        }
      }
    }

    // Write the fixed code back to the file
    fs.writeFileSync(filePath, fixedCode);
    return fixedCode;
  } catch (error) {
    console.error('Error fixing Python code:', error);
    throw error;
  }
}

async function getLocationCoordinates(location: string): Promise<GeocodingResult | null> {
  try {
    const encodedLocation = encodeURIComponent(location);
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodedLocation}&count=1&language=en&format=json`
    );
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Failed to get location coordinates');
  }
}

async function fetchWeatherData(latitude: number, longitude: number) {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m&models=jma_seamless&timezone=auto`
    );
    return await response.json();
  } catch (error) {
    console.error('Weather API error:', error);
    throw error;
  }
}

function processTomorrowWeather(weatherData: any, locationInfo: GeocodingResult): WeatherStats {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Format dates for comparison
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  
  // Get tomorrow's temperatures
  const hourlyTemps = weatherData.hourly.temperature_2m;
  const hourlyTimes = weatherData.hourly.time;
  
  const tomorrowTemps = hourlyTemps.filter((_: any, index: number) => {
    return hourlyTimes[index].startsWith(tomorrowDate);
  });
  
  // Calculate statistics
  const maxTemp = Math.max(...tomorrowTemps);
  const minTemp = Math.min(...tomorrowTemps);
  const avgTemp = tomorrowTemps.reduce((a: number, b: number) => a + b, 0) / tomorrowTemps.length;

  // Format location string
  const locationStr = locationInfo.admin1 
    ? `${locationInfo.name}, ${locationInfo.admin1}, ${locationInfo.country}`
    : `${locationInfo.name}, ${locationInfo.country}`;
  
  return {
    date: tomorrowDate,
    maxTemp: maxTemp.toFixed(1),
    minTemp: minTemp.toFixed(1),
    avgTemp: avgTemp.toFixed(1),
    location: locationStr,
    timezone: locationInfo.timezone
  };
}

function processWeatherForDate(weatherData: any, targetDate: Date, locationInfo: GeocodingResult): WeatherStats {
  // Format date for comparison
  const dateStr = targetDate.toISOString().split('T')[0];
  
  // Get temperatures for the target date
  const hourlyTemps = weatherData.hourly.temperature_2m;
  const hourlyTimes = weatherData.hourly.time;
  
  const dateTemps = hourlyTemps.filter((_: any, index: number) => {
    return hourlyTimes[index].startsWith(dateStr);
  });
  
  if (dateTemps.length === 0) {
    throw new Error('No weather data available for the specified date');
  }

  // Calculate statistics
  const maxTemp = Math.max(...dateTemps);
  const minTemp = Math.min(...dateTemps);
  const avgTemp = dateTemps.reduce((a: number, b: number) => a + b, 0) / dateTemps.length;

  // Format location string
  const locationStr = locationInfo.admin1 
    ? `${locationInfo.name}, ${locationInfo.admin1}, ${locationInfo.country}`
    : `${locationInfo.name}, ${locationInfo.country}`;
  
  return {
    date: dateStr,
    maxTemp: maxTemp.toFixed(1),
    minTemp: minTemp.toFixed(1),
    avgTemp: avgTemp.toFixed(1),
    location: locationStr,
    timezone: locationInfo.timezone
  };
}

function extractContext(question: string): QuestionContext {
  const doc = nlp(question);
  
  // Improved stock-specific subject extraction
  let subject: string | undefined;
  
  // Check for stock-related patterns
  const stockMatch = question.match(/(?:stock|price).*(?:of|in|for)\s+([A-Za-z\s.]+)(?:\?)?$/i);
  if (stockMatch) {
    subject = stockMatch[1].trim();
  } else {
    // Regular NLP subject extraction
    const nouns = doc.nouns().out('array');
    subject = nouns.length > 0 ? 
      nouns[nouns.length - 1].trim() : // Take the last noun as it's usually the company name
      undefined;
  }
  
  // Get main action
  const verbs = doc.verbs().out('array');
  const action = verbs.length > 0 ? verbs[0] : undefined;

  return {
    category: 'UNKNOWN',
    subject,
    action,
    timestamp: Date.now()
  };
}
function isFollowUpQuestion(question: string): boolean {
  const doc = nlp(question);
  return doc.match('(it|this|that|they|these|those)').found;
}