# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord bot that integrates with n8n workflows via webhooks. The bot creates threaded conversations for chat sessions and forwards messages to n8n for processing.

## Commands

### Development
- `npm start` or `npm run dev` - Start the bot
- `docker-compose up` - Run bot using Docker

### Dependencies
- `npm install` - Install dependencies (discord.js, axios)

## Architecture

### Core Components

1. **bot.js** - Main application file containing:
   - Discord client initialization with required intents
   - Slash command registration (/chat)
   - Thread-based conversation management
   - Webhook integration with n8n

2. **Session Management**
   - Uses Map to track active sessions by thread ID
   - Sessions include: threadId, userId, username, startTime
   - Automatic cleanup on thread deletion

3. **Webhook Flow**
   - Chat command creates new thread
   - All messages in active threads are forwarded to n8n webhook
   - Webhook payload includes: sessionId, threadId, userId, username, message, timestamp, type

### Environment Variables

Required in `.env` file:
- `BOT_TOKEN` - Discord bot token
- `GUILD_ID` - Discord server ID
- `N8N_WEBHOOK_URL` - n8n webhook endpoint

### Voice Memo Integration Notes

When implementing voice memo support:
- Current webhook URL: `https://n8n.airzm.com/webhook/discord-voice`
- Voice attachments need different handling than text messages
- Consider duplicate prevention since voice memos won't use slash commands
- Maintain thread creation pattern for consistency