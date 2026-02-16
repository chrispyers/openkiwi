
// using global fetch

// If using node 18+, fetch is global. If not, I might need to import it.
// Given tsx runs, it likely has fetch. But to be safe, I'll try without import first, or check process.version.
// Actually, let's look at `package.json` again. It has `@types/node` which usually means strict typing.
// If I use `fetch` without import in TS, I need `lib: ["dom"]` or `@types/node` >= 18.
// Let's assume global fetch is available.

export default {
    definition: {
        name: 'get_weather',
        description: 'Get the current weather conditions for a specific location. You can provide a city and state (e.g. San Francisco, CA), a zip code (e.g. 90210), or any other location name.',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The location to get weather for. Can be a city name, city and state, or zip code. For zip codes, it is recommended to include the country code (e.g. "23233 US") to ensure accuracy.'
                },
                unit: {
                    type: 'string',
                    enum: ['celsius', 'fahrenheit'],
                    description: 'The temperature unit to use. Defaults to celsius.'
                }
            },
            required: ['location']
        }
    },
    handler: async ({ location, unit = 'celsius' }: { location: string; unit?: 'celsius' | 'fahrenheit' }) => {
        try {
            // 1. Geocode the location
            // Using Nominatim (OpenStreetMap)
            const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;

            // User-Agent is required by Nominatim
            const geocodeResponse = await fetch(geocodeUrl, {
                headers: {
                    'User-Agent': 'LunaBot/1.0'
                }
            });

            if (!geocodeResponse.ok) {
                throw new Error(`Geocoding failed: ${geocodeResponse.statusText}`);
            }

            const geocodeData = await geocodeResponse.json() as any[];

            if (!geocodeData || geocodeData.length === 0) {
                return { error: `Could not find location: ${location}` };
            }

            const { lat, lon, display_name } = geocodeData[0];

            // 2. Fetch Weather
            // Using Open-Meteo
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&temperature_unit=${unit}&wind_speed_unit=kmh`;

            const weatherResponse = await fetch(weatherUrl);

            if (!weatherResponse.ok) {
                throw new Error(`Weather API failed: ${weatherResponse.statusText}`);
            }

            const weatherData = await weatherResponse.json() as any;
            const current = weatherData.current;
            const current_units = weatherData.current_units;

            // Map WMO weather codes to text
            const weatherCodes: Record<number, string> = {
                0: 'Clear sky',
                1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
                45: 'Fog', 48: 'Depositing rime fog',
                51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
                56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
                61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
                66: 'Light freezing rain', 67: 'Heavy freezing rain',
                71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
                77: 'Snow grains',
                80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
                85: 'Slight snow showers', 86: 'Heavy snow showers',
                95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
            };

            const condition = weatherCodes[current.weather_code] || 'Unknown';

            return {
                location: display_name,
                coordinates: { lat, lon },
                temperature: `${current.temperature_2m} ${current_units.temperature_2m}`,
                feels_like: `${current.apparent_temperature} ${current_units.apparent_temperature}`,
                condition: condition,
                humidity: `${current.relative_humidity_2m} ${current_units.relative_humidity_2m}`,
                wind_speed: `${current.wind_speed_10m} ${current_units.wind_speed_10m}`,
                precipitation: `${current.precipitation} ${current_units.precipitation}`,
                timestamp: current.time
            };

        } catch (error: any) {
            console.error('[GetWeather] Error:', error);
            return { error: `Failed to get weather: ${error.message}` };
        }
    }
};
