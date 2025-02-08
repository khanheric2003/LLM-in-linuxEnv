export interface QueryResponse {
    response: string;
    category?: string;
  }
  
  export interface QueryHandler {
    name: string;
    description: string;
    patterns: RegExp[];
    handle: (question: string) => Promise<string | null>;
  }
  
  export interface QuestionContext {
    category: string;
    subject?: string;
    action?: string;
    timestamp: number;
  }