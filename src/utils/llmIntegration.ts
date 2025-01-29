import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }[];
}

interface LLMConfig {
  provider: 'openai' | 'azure' | 'gemini';
  apiKey: string;
  apiVersion?: string;
  model?: string;
  endpoint?: string; // For Azure
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const makeOpenAIRequest = async (
  messages: ChatMessage[],
  apiKey: string,
  apiVersion: string,
  model: string,
  maxRetries: number = 3
): Promise<ChatResponse> => {
  let lastError;
  let retryDelay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.post<ChatResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages,
          max_tokens: 800,
          temperature: 0.7,
          frequency_penalty: 0,
          presence_penalty: 0,
          top_p: 0.95,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Version': apiVersion
          }
        }
      );

      return response.data;
    } catch (error) {
      lastError = error;

      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '0') * 1000;
          const waitTime = retryAfter || retryDelay;

          console.log(`Rate limited. Retrying in ${waitTime/1000} seconds...`);
          await sleep(waitTime);

          retryDelay *= 2;
          continue;
        }
        throw error;
      }
    }
  }

  throw lastError;
};

const makeAzureRequest = async (
  messages: ChatMessage[],
  config: LLMConfig,
  maxRetries: number = 3
): Promise<ChatResponse> => {
  let lastError;
  let retryDelay = 1000;

  if (!config.endpoint) {
    throw new Error('Azure endpoint is required');
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.post<ChatResponse>(
        `${config.endpoint}/openai/deployments/${config.model}/chat/completions?api-version=${config.apiVersion}`,
        {
          messages,
          max_tokens: 800,
          temperature: 0.7,
          frequency_penalty: 0,
          presence_penalty: 0,
          top_p: 0.95,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey
          }
        }
      );

      return response.data;
    } catch (error) {
      lastError = error;

      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '0') * 1000;
          const waitTime = retryAfter || retryDelay;

          console.log(`Rate limited. Retrying in ${waitTime/1000} seconds...`);
          await sleep(waitTime);

          retryDelay *= 2;
          continue;
        }
        throw error;
      }
    }
  }

  throw lastError;
};

const makeGeminiRequest = async (
  messages: ChatMessage[],
  apiKey: string
): Promise<string> => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  // Convert ChatMessage format to Gemini format
  const messageContent = messages.map(msg => msg.content).join('\n');

  try {
    const result = await model.generateContent(messageContent);
    const response = await result.response;
    return response.text();
  } catch (error) {
    throw error;
  }
};

export const processLLMCommand = async (
  question: string,
  config: LLMConfig
): Promise<string> => {
  try {
    if (!config.apiKey) {
      throw new Error(`Missing API key for ${config.provider}. Please check your configuration.`);
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful terminal assistant with access to the file system and development environment. You can help with file operations, coding, and development tasks.'
      },
      {
        role: 'user',
        content: question
      }
    ];

    let content: string;

    switch (config.provider) {
      case 'openai':
        const openAIResponse = await makeOpenAIRequest(
          messages,
          config.apiKey,
          config.apiVersion || '2024-01-01',
          config.model || 'gpt-3.5-turbo'
        );
        content = openAIResponse.choices[0]?.message?.content;
        break;

      case 'azure':
        const azureResponse = await makeAzureRequest(messages, config);
        content = azureResponse.choices[0]?.message?.content;
        break;

      case 'gemini':
        content = await makeGeminiRequest(messages, config.apiKey);
        break;

      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }

    if (!content) {
      throw new Error('No response content received from LLM provider');
    }

    return content;

  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (axios.isAxiosError(error) && error.response) {
      errorMessage = `API Error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`;
    }

    console.error('LLM Integration Error:', error);
    return `Error: ${errorMessage}\nPlease check your LLM configuration and try again.`;
  }
};