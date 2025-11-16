require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// KONFIG 
const CHANNEL_ID = process.env.CHANNEL_ID;     // kanal gde bot šalje prognozu
const CITY = "Valjevo,RS";                     // grad (fiksno Valjevo)
const TEMP_DELTA = 1;                          // °C promena za ažuriranje poruke
const CHECK_INTERVAL_MIN = 10;                 // svakih X minuta proverava

let lastState = {
  targetTime: null,
  temp: null,
  hasRain: null,
  description: null,
  messageId: null
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

async function getForecastForNextHour() {
  const apiKey = process.env.WEATHER_API_KEY;

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(CITY)}&appid=${apiKey}&units=metric&lang=sr`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.cod !== "200") {
    console.error("Weather error:", data);
    return null;
  }

  const now = new Date();
  const target = new Date(now.getTime() + 60 * 60 * 1000); // +1h

  let best = null;
  let bestDiff = Infinity;

  for (const item of data.list) {
    const t = new Date(item.dt * 1000);
    const diff = Math.abs(t - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = item;
    }
  }

  if (!best) return null;

  const t = new Date(best.dt * 1000);
  const temp = best.main.temp;
  const desc = best.weather[0].description;
  const hasRain = !!(best.rain && (best.rain["1h"] || best.rain["3h"]));

  return {
    targetTime: t,
    temp,
    desc,
    hasRain
  };
}

function isSignificantChange(oldState, newState) {
  if (!oldState.targetTime) return true;

  const dtDiff = Math.abs(newState.targetTime - oldState.targetTime);
  if (dtDiff > 2 * 60 * 60 * 1000) return true;

  const tempDiff = Math.abs(newState.temp - oldState.temp);
  if (tempDiff >= TEMP_DELTA) return true;

  if (oldState.hasRain !== newState.hasRain) return true;

  if (oldState.description !== newState.desc) return true;

  return false;
}

async function sendOrUpdateWeather() {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error("Channel not found");
      return;
    }

    const forecast = await getForecastForNextHour();
    if (!forecast) return;

    const shouldUpdate = isSignificantChange(lastState, forecast);
    if (!shouldUpdate) return;

    if (lastState.messageId) {
      try {
        const oldMsg = await channel.messages.fetch(lastState.messageId);
        await oldMsg.delete();
      } catch (e) {
        console.warn("Ne mogu da obrišem staru poruku:", e.message);
      }
    }

    const timeStr = forecast.targetTime.toLocaleTimeString("sr-RS", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const embed = new EmbedBuilder()
      .setTitle(`Prognoza za Valjevo za ${timeStr}`)
      .setDescription(forecast.desc)
      .addFields(
        { name: "Temperatura", value: `${forecast.temp.toFixed(1)}°C`, inline: true },
        { name: "Padavine", value: forecast.hasRain ? "🌧 Moguća kiša" : "☀ Bez padavina", inline: true }
      )
      .setTimestamp(new Date());

    const msg = await channel.send({ embeds: [embed] });

    lastState = {
      targetTime: forecast.targetTime,
      temp: forecast.temp,
      hasRain: forecast.hasRain,
      description: forecast.desc,
      messageId: msg.id
    };
  } catch (err) {
    console.error("Greška u sendOrUpdateWeather:", err);
  }
}

client.once("ready", () => {
  console.log(`Ulogovan kao ${client.user.tag}`);
  sendOrUpdateWeather();
  setInterval(sendOrUpdateWeather, CHECK_INTERVAL_MIN * 60 * 1000);
});

client.login(process.env.DISCORD_BOT_TOKEN);
