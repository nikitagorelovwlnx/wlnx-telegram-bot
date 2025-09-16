# WLNX Telegram Bot - Setup Guide

## Quick Start

### 1. Create Telegram Bot

1. Open Telegram and find @BotFather
2. Send `/newbot` command
3. Choose a name for your bot (e.g., "WLNX Assistant")
4. Choose a username (e.g., "wlnx_assistant_bot")
5. Copy the bot token provided by BotFather

### 2. Configure Environment

1. Copy the environment file:
```bash
cp .env.example .env
```

2. Edit `.env` file with your settings:
```env
# Required
BOT_TOKEN=your_telegram_bot_token_from_botfather
BOT_USERNAME=your_bot_username
API_BASE_URL=http://localhost:3000/api

# OpenAI for Wellness Coaching (Required for wellness features)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Optional
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=development
LOG_LEVEL=info
ADMIN_USER_IDS=your_telegram_user_id
```

### 3. Start WLNX API Server

Make sure your WLNX API server is running on the configured URL (default: http://localhost:3000).

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Bot

For development:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

## Getting Your Telegram User ID

To set yourself as an admin, you need your Telegram user ID:

1. Start a chat with @userinfobot
2. Send any message
3. Copy your user ID from the response
4. Add it to `ADMIN_USER_IDS` in your `.env` file

## Testing the Bot

1. Find your bot in Telegram by username
2. Send `/start` command
3. Try registering with `/register`
4. Test adding an interview with `/add_interview`

## Available Commands

### Basic Commands
- `/start` - Initialize bot and check wellness interview status
- `/help` - Show help information
- `/register` - Register new account
- `/login` - Login to existing account
- `/logout` - Logout from system
- `/profile` - Show user profile

### Interview Management
- `/interviews` - Show job interviews
- `/add_interview` - Add new job interview result
- `/stats` - Show job interview statistics

### Wellness Coaching (NEW!)
- `/wellness` - Show wellness statistics and options
- `/wellness_start` - Start new wellness interview with AI coach
- **Interactive Chat** - Once wellness interview starts, just type messages to chat with the AI wellness coach

### Settings & Admin
- `/settings` - Bot settings
- `/admin` - Admin panel (admin users only)

## Wellness Coaching Feature

The bot now includes an AI-powered wellness coach that conducts personalized interviews to collect health and lifestyle information.

### How it Works:
1. **Authentication Check**: Bot verifies user is logged in
2. **Interview Status**: Checks if user has completed wellness interview
3. **AI Coach Interaction**: Uses ChatGPT-4 as a professional wellness coach
4. **Data Collection**: Automatically extracts and stores:
   - Age
   - Location (city/country)
   - Medical contraindications
   - Health goals
   - Lifestyle factors

### Wellness Interview Flow:
1. User starts chat with bot (`/start`)
2. If authenticated but no wellness interview completed, bot prompts to start
3. AI wellness coach introduces itself and begins structured interview
4. User chats naturally with the coach
5. Coach asks targeted questions about health, lifestyle, goals
6. Statistics are automatically extracted and saved
7. User can complete interview anytime or continue later

## Troubleshooting

### Bot doesn't respond
- Check if BOT_TOKEN is correct
- Verify the bot is running without errors
- Check logs for error messages

### API connection errors
- Ensure WLNX API server is running
- Verify API_BASE_URL is correct
- Check network connectivity

### Authentication issues
- Verify JWT_SECRET matches your API server
- Check API server authentication endpoints

### Wellness coaching not working
- Ensure OPENAI_API_KEY is set correctly
- Check OpenAI API quota and billing
- Verify OPENAI_MODEL is supported (gpt-4, gpt-3.5-turbo)
- Check logs for OpenAI API errors

### Getting OpenAI API Key
1. Go to https://platform.openai.com/
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to your .env file
6. Ensure you have sufficient credits/quota

## Production Deployment

### Using Docker

1. Build the image:
```bash
docker build -t wlnx-telegram-bot .
```

2. Run with environment file:
```bash
docker run -d --env-file .env wlnx-telegram-bot
```

### Using Docker Compose

```bash
docker-compose up -d
```

### Manual Deployment

1. Build the project:
```bash
npm run build
```

2. Set production environment variables
3. Start the application:
```bash
npm start
```

## Webhook Setup (Production)

For production, you may want to use webhooks instead of polling:

1. Set `WEBHOOK_URL` in your environment
2. Set `WEBHOOK_PORT` (default: 8080)
3. Ensure your server is accessible from the internet
4. Telegram will send updates to your webhook URL

## Monitoring

The bot includes comprehensive logging. Set `LOG_LEVEL` to:
- `error` - Only errors
- `warn` - Warnings and errors
- `info` - General information (recommended)
- `debug` - Detailed debugging

## Security Considerations

- Keep your BOT_TOKEN secret
- Use strong JWT_SECRET
- Limit admin access with ADMIN_USER_IDS
- Use HTTPS in production
- Regularly update dependencies
