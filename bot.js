const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const activeSessions = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Start a new chat session with the n8n workflow')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Your initial message')
        .setRequired(true)
    )
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    
    console.log('Started refreshing application (/) commands.');
    
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands },
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  if (interaction.commandName === 'chat') {
    const initialMessage = interaction.options.getString('message');
    
    try {
      await interaction.deferReply();
      
      const thread = await interaction.channel.threads.create({
        name: `Chat with ${interaction.user.username}`,
        autoArchiveDuration: 60,
        type: ChannelType.PublicThread,
        reason: 'New n8n chat session'
      });
      
      const sessionId = `${interaction.guildId}-${thread.id}`;
      activeSessions.set(sessionId, {
        threadId: thread.id,
        userId: interaction.user.id,
        username: interaction.user.username,
        startTime: new Date()
      });
      
      await interaction.editReply(`Chat session started! Continue the conversation in ${thread}`);
      
      const webhookData = {
        sessionId: sessionId,
        threadId: thread.id,
        userId: interaction.user.id,
        username: interaction.user.username,
        message: initialMessage,
        timestamp: new Date().toISOString(),
        type: 'session_start'
      };
      
      const response = await axios.post(process.env.N8N_WEBHOOK_URL, webhookData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.message) {
        await thread.send(response.data.message);
      }
      
    } catch (error) {
      console.error('Error starting chat session:', error);
      await interaction.editReply('Failed to start chat session. Please try again.');
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.channel.isThread()) return;
  
  const sessionId = `${message.guildId}-${message.channelId}`;
  const session = activeSessions.get(sessionId);
  
  if (!session) return;
  
  try {
    const webhookData = {
      sessionId: sessionId,
      threadId: message.channelId,
      userId: message.author.id,
      username: message.author.username,
      message: message.content,
      timestamp: new Date().toISOString(),
      type: 'message'
    };
    
    const response = await axios.post(process.env.N8N_WEBHOOK_URL, webhookData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.message) {
      await message.channel.send(response.data.message);
    }
    
  } catch (error) {
    console.error('Error forwarding message to n8n:', error);
    await message.channel.send('Sorry, I encountered an error processing your message.');
  }
});

client.on('threadDelete', (thread) => {
  const sessionId = `${thread.guildId}-${thread.id}`;
  if (activeSessions.has(sessionId)) {
    activeSessions.delete(sessionId);
    console.log(`Session ${sessionId} ended`);
  }
});

client.login(process.env.BOT_TOKEN);

