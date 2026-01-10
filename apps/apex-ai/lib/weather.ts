
interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
}

interface WeatherResult {
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
  daily?: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    time: string[];
  };
}

export async function getWeather(city: string) {
  try {
    // 1. Get coordinates
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return { error: `City '${city}' not found.` };
    }

    const location: GeoResult = geoData.results[0];
    const { latitude, longitude, name, country } = location;

    // 2. Get weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    return {
      location: { name, country, latitude, longitude },
      weather: weatherData
    };
  } catch (error) {
    console.error("Weather API error:", error);
    return { error: "Failed to fetch weather data." };
  }
}
