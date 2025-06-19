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
      
      const sessionId = thread.id;
      activeSessions.set(sessionId, {
        threadId: thread.id,
        userId: interaction.user.id,
        username: interaction.user.username,
        startTime: new Date()
      });
      
      await interaction.editReply(`Chat session started! Continue the conversation in ${thread}`);
      
      const statusMessage = await thread.send('🔄 Sending data to n8n workflow...');
      
      const webhookData = {
        sessionId: sessionId,
        threadId: thread.id,
        userId: interaction.user.id,
        username: interaction.user.username,
        message: initialMessage,
        timestamp: new Date().toISOString(),
        type: 'session_start'
      };
      
      try {
        const response = await axios.post(process.env.N8N_WEBHOOK_URL, webhookData, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        
        await statusMessage.delete();
        
        if (response.data && response.data.message) {
          await thread.send(response.data.message);
        } else {
          await thread.send('✅ Connected to n8n workflow. Waiting for response...');
        }
        
      } catch (webhookError) {
        await statusMessage.delete();
        console.error('Error calling n8n webhook:', webhookError.message);
        
        let errorMessage = '❌ Failed to connect to n8n workflow.\n';
        if (webhookError.code === 'ECONNREFUSED') {
          errorMessage += 'The webhook URL is not accessible.';
        } else if (webhookError.response) {
          errorMessage += `Error: ${webhookError.response.status} ${webhookError.response.statusText}`;
        } else if (webhookError.request) {
          errorMessage += 'No response received from n8n.';
        } else {
          errorMessage += `Error: ${webhookError.message}`;
        }
        
        await thread.send(errorMessage);
      }
      
    } catch (error) {
      console.error('Error creating chat session:', error);
      await interaction.editReply('Failed to create chat session. Please try again.');
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.channel.isThread()) return;
  
  const sessionId = message.channelId;
  const session = activeSessions.get(sessionId);
  
  if (!session) return;
  
  const statusMessage = await message.channel.send('🔄 Processing your message...');
  
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
      },
      timeout: 30000
    });
    
    await statusMessage.delete();
    
    if (response.data && response.data.message) {
      await message.channel.send(response.data.message);
    } else {
      await message.channel.send('✅ Message sent to n8n workflow.');
    }
    
  } catch (error) {
    await statusMessage.delete();
    console.error('Error forwarding message to n8n:', error.message);
    
    let errorMessage = '❌ Failed to process your message.\n';
    if (error.code === 'ECONNREFUSED') {
      errorMessage += 'The n8n webhook is not accessible.';
    } else if (error.response) {
      errorMessage += `Error: ${error.response.status} ${error.response.statusText}`;
    } else if (error.request) {
      errorMessage += 'No response received from n8n.';
    } else {
      errorMessage += `Error: ${error.message}`;
    }
    
    await message.channel.send(errorMessage);
  }
});

client.on('threadDelete', (thread) => {
  const sessionId = thread.id;
  if (activeSessions.has(sessionId)) {
    activeSessions.delete(sessionId);
    console.log(`Session ${sessionId} ended`);
  }
});

client.login(process.env.BOT_TOKEN);

