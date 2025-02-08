// server/handlers/index.ts
import { QueryHandler } from '../types/type';
import { weatherHandler } from './weatherHandler';
import { stockHandler } from './stockHandler';

// Export all handlers array
export const queryHandlers: QueryHandler[] = [
  weatherHandler,
  stockHandler
];

// Export individual handlers
export { weatherHandler } from './weatherHandler';
export { stockHandler } from './stockHandler';

// Export helper function for available categories
export function getAvailableCategories(): string {
  return queryHandlers
    .map(handler => `${handler.name}: ${handler.description}`)
    .join('\n');
}

// Export helper function for identifying and handling queries
export async function identifyAndHandleQuery(question: string) {
  for (const handler of queryHandlers) {
    if (handler.patterns.some(pattern => pattern.test(question))) {
      try {
        const response = await handler.handle(question);
        if (response) {
          return {
            response,
            category: handler.name
          };
        }
      } catch (error) {
        console.error(`Error in ${handler.name} handler:`, error);
      }
    }
  }
  return null;
}