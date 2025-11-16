require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");
const axios = require("axios");

// KREIRAŠ CLIENT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// FUNKCIJA koja šalje prognozu
async function sendWeather(client) {
    try {
        const city = "Valjevo";
        const apiKey = process.env.WEATHER_API_KEY; // OpenWeather KEY
        const channelId = process.env.CHAT_ID;      // kanal gde bot šalje

        const channel = client.channels.cache.get(channelId);
        if (!channel) return console.log("Channel not found.");

        const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric&lang=sr`;

        const res = await axios.get(url);
        const forecast = res.data.list[1]; // vreme 3h unapred

        const time = new Date((forecast.dt + 3600) * 1000).toLocaleTimeString("sr-RS", {
            hour: "2-digit",
            minute: "2-digit",
        });

        const temp = forecast.main.temp.toFixed(1);
        const desc = forecast.weather[0].description;

        const message = `🌤 *Prognoza za Valjevo u ${time}:*\n🌡 Temperatura: ${temp}°C\n🌥 Vreme: ${desc}`;

        await channel.send(message);
        console.log("Poslata poruka u:", time);
    } catch (err) {
        console.error("Greška u slanju prognoze:", err);
    }
}

// CRON PALI TEK KAD JE BOT SPREMAN
client.once("ready", () => {
    console.log(`Logovan kao ${client.user.tag}`);

    // POKREĆE SE SVAKI SAT U :00
    cron.schedule("0 * * * *", () => {
        console.log("Cron aktiviran - šaljem prognozu…");
        sendWeather(client); // 👈 prosleđuješ client
    });
});

client.login(process.env.BOT_TOKEN);
