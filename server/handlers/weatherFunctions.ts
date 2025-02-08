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
  
  function parseDate(dateStr: string): Date | null {
    try {
      const originalInput = dateStr.toLowerCase().trim();
      console.log('Parsing date:', originalInput);
  
      // Handle "tomorrow"
      if (originalInput === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
  
      // Month names mapping
      const months: { [key: string]: number } = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sep': 8, 'sept': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
      };
  
      // Common date patterns
      const patterns = [
        // Feb 10, February 10th, Feb 10th 2024
        {
          regex: /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?$/i,
          handler: (match: RegExpMatchArray) => {
            const monthStr = match[0].split(/\s+/)[0].toLowerCase();
            const day = parseInt(match[1]);
            const year = match[2] ? parseInt(match[2]) : new Date().getFullYear();
            const month = months[monthStr.replace('.', '')];
            return new Date(year, month, day);
          }
        },
        // 10th Feb, 10 February, 10th February 2024
        {
          regex: /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*(\d{4})?$/i,
          handler: (match: RegExpMatchArray) => {
            const parts = match[0].split(/\s+/);
            const day = parseInt(parts[0]);
            const monthStr = parts[1].toLowerCase();
            const year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();
            const month = months[monthStr.replace('.', '')];
            return new Date(year, month, day);
          }
        },
        // 2024-02-10, 2024/02/10
        {
          regex: /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/,
          handler: (match: RegExpMatchArray) => {
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          }
        },
        // 02/10/2024, 10/02/2024 (assumes MM/DD/YYYY for US format)
        {
          regex: /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
          handler: (match: RegExpMatchArray) => {
            const [month, day, year] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
            return new Date(year, month - 1, day);
          }
        },
        // "next monday", "this friday"
        {
          regex: /^(?:next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
          handler: (match: RegExpMatchArray) => {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDay = days.indexOf(match[1].toLowerCase());
            const today = new Date();
            const currentDay = today.getDay();
            let daysToAdd = targetDay - currentDay;
            
            if (match[0].toLowerCase().startsWith('next')) {
              daysToAdd += 7;
            } else if (daysToAdd <= 0) {
              daysToAdd += 7;
            }
            
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysToAdd);
            return targetDate;
          }
        },
        // "feb 10", "feb10"
        {
          regex: /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})$/i,
          handler: (match: RegExpMatchArray) => {
            const parts = match[0].split(/\s+/);
            const monthStr = parts[0].toLowerCase();
            const day = parseInt(parts[1] || match[1]);
            const year = new Date().getFullYear();
            const month = months[monthStr.replace('.', '')];
            return new Date(year, month, day);
          }
        }
      ];
  
      // Try each pattern
      for (const { regex, handler } of patterns) {
        const match = originalInput.match(regex);
        if (match) {
          console.log('Matched pattern:', regex);
          const date = handler(match);
          
          // Validate the resulting date
          if (date && !isNaN(date.getTime())) {
            console.log('Parsed date:', date.toISOString());
            return date;
          }
        }
      }
  
      // If no patterns match, try native Date parsing as last resort
      const fallbackDate = new Date(originalInput);
      if (!isNaN(fallbackDate.getTime())) {
        console.log('Parsed using native Date:', fallbackDate.toISOString());
        return fallbackDate;
      }
  
      console.log('Failed to parse date');
      return null;
    } catch (error) {
      console.error('Date parsing error:', error);
      return null;
    }
  }
  
  function processWeatherForDate(weatherData: any, targetDate: Date, locationInfo: GeocodingResult): WeatherStats {
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const hourlyTemps = weatherData.hourly.temperature_2m;
    const hourlyTimes = weatherData.hourly.time;
    
    const dateTemps = hourlyTemps.filter((_: any, index: number) => {
      return hourlyTimes[index].startsWith(dateStr);
    });
    
    if (dateTemps.length === 0) {
      throw new Error('No weather data available for the specified date');
    }
  
    const maxTemp = Math.max(...dateTemps);
    const minTemp = Math.min(...dateTemps);
    const avgTemp = dateTemps.reduce((a: number, b: number) => a + b, 0) / dateTemps.length;
  
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
  
  export async function handleWeatherQuery(question: string): Promise<string | null> {
    // Add patterns for current weather
    const weatherPatterns = [
      /weather.*(?:in|for|at)\s+([a-zA-Z\s,]+)\s+(?:on|for)\s+([a-zA-Z0-9\s,]+)(?:\?)?$/i,  // weather in Tokyo on Feb 15
      /weather.*(?:on|for)\s+([a-zA-Z0-9\s,]+)\s+(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\?)?$/i,   // weather on Feb 15 in Tokyo
      /weather.*(?:now|right now).*(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\?)?$/i,                 // weather right now in Tokyo
      /weather.*(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\s+(?:now|right now))(?:\?)?$/i,           // weather in Tokyo right now
      /weather.*(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\?)?$/i                                     // weather in Tokyo
    ];
    
    let match = null;
    let location = '';
    let dateStr = '';
    let isCurrentWeather = false;
  
    // First check for current weather patterns
    for (const pattern of weatherPatterns.slice(2)) {
      match = question.match(pattern);
      if (match) {
        console.log('Matched current weather pattern:', pattern);
        location = match[1].trim();
        isCurrentWeather = true;
        break;
      }
    }
  
    // If not current weather, check forecast patterns
    if (!match) {
      for (const pattern of weatherPatterns.slice(0, 2)) {
        match = question.match(pattern);
        if (match) {
          if (pattern.toString().includes('on|for\\)\\s+\\(')) {
            dateStr = match[1].trim();
            location = match[2].trim();
          } else {
            location = match[1].trim();
            dateStr = match[2].trim();
          }
          break;
        }
      }
    }
  
    // Check for tomorrow pattern as fallback
    if (!match) {
      const tomorrowPattern = /weather.*tomorrow.*(?:in|for|at)\s+([a-zA-Z\s,]+)(?:\?)?$/i;
      match = question.match(tomorrowPattern);
      if (match) {
        location = match[1].trim();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateStr = tomorrow.toISOString().split('T')[0];
      }
    }
  
    if (match) {
      try {
        const locationInfo = await getLocationCoordinates(location);
        if (!locationInfo) {
          return `Sorry, I couldn't find the location: ${location}. Please try with a different location name.`;
        }
  
        const weatherData = await fetchWeatherData(locationInfo.latitude, locationInfo.longitude);
  
        // Handle current weather
        if (isCurrentWeather) {
          const currentHour = new Date().getHours();
          const currentTemp = weatherData.hourly.temperature_2m[currentHour];
          
          const currentTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
  
          const locationStr = locationInfo.admin1 
            ? `${locationInfo.name}, ${locationInfo.admin1}, ${locationInfo.country}`
            : `${locationInfo.name}, ${locationInfo.country}`;
  
          return `Current Weather Report\n\n` +
                 `Location: ${locationStr}\n` +
                 `Time: ${currentTime}\n` +
                 `Current Temperature: ${currentTemp.toFixed(1)}°C\n` +
                 `Coordinates: ${locationInfo.latitude}, ${locationInfo.longitude}\n` +
                 `Timezone: ${locationInfo.timezone}`;
        }
  
        // Handle forecast weather
        const targetDate = dateStr === '' ? null : parseDate(dateStr);
        if (!targetDate) {
          return `Sorry, I couldn't understand the date: ${dateStr}. Please try with a different date format.`;
        }
  
        const maxForecastDate = new Date();
        maxForecastDate.setDate(maxForecastDate.getDate() + 16);
        if (targetDate > maxForecastDate) {
          return `Sorry, I can only provide weather forecasts up to ${maxForecastDate.toLocaleDateString()}. Please try with a closer date.`;
        }
  
        const weatherStats = processWeatherForDate(weatherData, targetDate, locationInfo);
        
        const today = new Date();
        const todayStr = today.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
  
        const targetDateStr = targetDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        return `Current date: ${todayStr}\n\n` +
               `Location coordinates: ${locationInfo.latitude}, ${locationInfo.longitude}\n` +
               `Weather forecast for ${weatherStats.location} on ${targetDateStr}:\n` +
               `- Maximum temperature: ${weatherStats.maxTemp}°C\n` +
               `- Minimum temperature: ${weatherStats.minTemp}°C\n` +
               `- Average temperature: ${weatherStats.avgTemp}°C\n` +
               `- Timezone: ${weatherStats.timezone}`;
      } catch (error) {
        console.error('Weather processing error:', error);
        if (error instanceof Error && error.message.includes('No weather data available')) {
          return `Sorry, no weather data is available for the specified date. Please try with a date within the next 16 days.`;
        }
        throw new Error('Failed to fetch weather data');
      }
    }
    
    return null;
  }