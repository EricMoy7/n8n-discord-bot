const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    await axios.post(process.env.N8N_WEBHOOK_URL, {
      user: message.author.username,
      content: message.content,
      channelId: message.channel.id,
      messageId: message.id
    });
  } catch (err) {
    console.error("❌ Failed to forward message:", err.message);
  }
});

client.login(process.env.BOT_TOKEN);

