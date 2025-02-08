import { QueryHandler } from '../types/type';
import { handleWeatherQuery } from './weatherFunctions';

// Define the patterns
const weatherPatterns = [
  /weather.*(?:in|for|at)\s+([a-zA-Z\s,]+)\s+(?:on|for)\s+([a-zA-Z0-9\s,]+)(?:\?)?$/i,  // weather in Tokyo on Feb 15
  /weather.*(?:on|for)\s+([a-zA-Z0-9\s,]+)\s+(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\?)?$/i,   // weather on Feb 15 in Tokyo
  /weather.*(?:now|right now).*(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\?)?$/i,                 // weather right now in Tokyo
  /weather.*(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\s+(?:now|right now))(?:\?)?$/i,           // weather in Tokyo right now
  /weather.*(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\?)?$/i,                                    // weather in Tokyo
  /weather.*tomorrow.*(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\?)?$/i                           // weather tomorrow in Tokyo
];

export const weatherHandler: QueryHandler = {
  name: 'Weather',
  description: 'Get weather forecasts for any location and date',
  patterns: weatherPatterns,
  handle: async (question: string): Promise<string | null> => {
    console.log('Weather handler received question:', question);
    try {
      return await handleWeatherQuery(question);
    } catch (error) {
      console.error('Error in weather handler:', error);
      return null;
    }
  }
};