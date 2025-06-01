
import type { ApiWeatherResponse, DailyWeather } from '@/types';
import {
  Sun, CloudSun, Cloud, Cloudy, CloudFog, CloudDrizzle,
  CloudRain, CloudSnow, CloudLightning, Umbrella, Thermometer,
  Wind, Sunrise, Sunset, Waves, Droplets, Eye, Gauge, CalendarDays, HelpCircle
} from 'lucide-react';

interface WeatherCodeInfo {
  description: string;
  icon: React.ElementType;
}

const weatherCodeMap: Record<number, WeatherCodeInfo> = {
  0: { description: 'Clear sky', icon: Sun },
  1: { description: 'Mainly clear', icon: CloudSun },
  2: { description: 'Partly cloudy', icon: Cloud },
  3: { description: 'Overcast', icon: Cloudy },
  45: { description: 'Fog', icon: CloudFog },
  48: { description: 'Depositing rime fog', icon: CloudFog },
  51: { description: 'Light drizzle', icon: CloudDrizzle },
  53: { description: 'Moderate drizzle', icon: CloudDrizzle },
  55: { description: 'Dense drizzle', icon: CloudDrizzle },
  56: { description: 'Light freezing drizzle', icon: CloudDrizzle },
  57: { description: 'Dense freezing drizzle', icon: CloudDrizzle },
  61: { description: 'Slight rain', icon: CloudRain },
  63: { description: 'Moderate rain', icon: CloudRain },
  65: { description: 'Heavy rain', icon: CloudRain },
  66: { description: 'Light freezing rain', icon: CloudRain },
  67: { description: 'Heavy freezing rain', icon: CloudRain },
  71: { description: 'Slight snow fall', icon: CloudSnow },
  73: { description: 'Moderate snow fall', icon: CloudSnow },
  75: { description: 'Heavy snow fall', icon: CloudSnow },
  77: { description: 'Snow grains', icon: CloudSnow },
  80: { description: 'Slight rain showers', icon: CloudRain },
  81: { description: 'Moderate rain showers', icon: CloudRain },
  82: { description: 'Violent rain showers', icon: CloudRain },
  85: { description: 'Slight snow showers', icon: CloudSnow },
  86: { description: 'Heavy snow showers', icon: CloudSnow },
  95: { description: 'Thunderstorm', icon: CloudLightning },
  96: { description: 'Thunderstorm with slight hail', icon: CloudLightning },
  99: { description: 'Thunderstorm with heavy hail', icon: CloudLightning },
};

export function getWeatherInfo(weatherCode: number): WeatherCodeInfo {
  return weatherCodeMap[weatherCode] || { description: 'Unknown', icon: HelpCircle };
}

export async function fetchWeatherForecast(latitude: number, longitude: number): Promise<DailyWeather[] | null> {
  const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}&daily=weather_code,temperature_2m_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error('Failed to fetch weather data:', response.statusText);
      return null;
    }
    const data: ApiWeatherResponse = await response.json();
    if (data && data.daily && data.daily.time) {
      return data.daily.time.map((date, index) => {
        const code = data.daily.weather_code[index];
        const info = getWeatherInfo(code);
        return {
          date: date,
          weatherCode: code,
          maxTemp: Math.round(data.daily.temperature_2m_max[index]),
          description: info.description,
          icon: info.icon,
        };
      });
    }
    return null;
  } catch (error) {
    console.error('Error fetching or processing weather data:', error);
    return null;
  }
}

