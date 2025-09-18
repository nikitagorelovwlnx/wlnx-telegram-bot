# WLNX Telegram Bot

TypeScript Telegram bot integrated with WLNX API Server for managing interviews, calendar integrations, and user data.

## Features

- 🔐 User authentication (login/register)
- 📊 Interview results management
- 🌿 **AI-powered wellness coaching with ChatGPT**
- 📈 Automatic health statistics extraction
- 🏥 **Health check monitoring system (port 3002)**
- 📅 Calendar integration support
- 🤖 Interactive Telegram interface
- 👑 Admin panel
- 🔔 Notifications support (planned)

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Running WLNX API Server
- Telegram Bot Token (from @BotFather)
- OpenAI API Key (for wellness coaching features)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd wlnx-telegram-bot
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
BOT_TOKEN=your_telegram_bot_token_here
BOT_USERNAME=your_bot_username
API_BASE_URL=http://localhost:3000/api
JWT_SECRET=your-super-secret-jwt-key
```

## Configuration

### Required Environment Variables

- `BOT_TOKEN` - Your Telegram bot token from @BotFather
- `BOT_USERNAME` - Your bot's username (without @)
- `API_BASE_URL` - URL of your WLNX API server

### Optional Environment Variables

- `API_TIMEOUT` - API request timeout in milliseconds (default: 10000)
- `JWT_SECRET` - JWT secret for token validation
- `NODE_ENV` - Environment (development/production)
- `WEBHOOK_URL` - Webhook URL for production
- `WEBHOOK_PORT` - Webhook port (default: 8080)
- `ADMIN_USER_IDS` - Comma-separated list of admin user IDs
- `LOG_LEVEL` - Logging level (error/warn/info/debug)

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Testing

```bash
npm test
```

### Health Monitoring

```bash
# Check bot health status
curl http://localhost:3002/health

# Simple ping check
curl http://localhost:3002/ping

# Using npm scripts
npm run health
```

## Bot Commands

### Public Commands
- `/start` - Initialize bot and show welcome message
- `/help` - Show help information
- `/login` - Login to WLNX system
- `/register` - Register new account

### Authenticated User Commands
- `/profile` - Show user profile information
- `/logout` - Logout from system
- `/interviews` - Show user's interviews
- `/save_interview` - Save current conversation to server
- `/new_interview` - Start new interview session (reset current)
- `/stats` - Show interview statistics
- `/settings` - Bot settings
- `/calendar` - Calendar settings (planned)

### Admin Commands
- `/admin` - Admin panel (admin users only)

## Project Structure

```
src/
├── bot.ts                 # Main bot class
├── index.ts              # Application entry point
├── config/
│   └── index.ts          # Configuration management
├── handlers/
│   ├── authHandler.ts    # Authentication handlers
│   ├── commandHandler.ts # Command handlers
│   └── interviewHandler.ts # Interview management
├── services/
│   ├── apiService.ts     # WLNX API integration
│   └── userService.ts    # User session management
├── types/
│   └── index.ts          # TypeScript type definitions
└── utils/
    ├── helpers.ts        # Utility functions
    └── logger.ts         # Logging utilities
```

## API Integration

The bot integrates with WLNX API Server endpoints:

### User Management
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update user data

### Interview Results
- `POST /api/interviews` - Create interview result
- `GET /api/interviews` - Get user's interviews
- `GET /api/interviews/:id` - Get specific interview
- `PUT /api/interviews/:id` - Update interview
- `DELETE /api/interviews/:id` - Delete interview

### Calendar Integration
- `POST /api/calendar` - Create calendar integration
- `GET /api/calendar` - Get integrations
- `PUT /api/calendar/:id` - Update integration
- `DELETE /api/calendar/:id` - Delete integration

### Telegram Integration
- `POST /api/telegram` - Create Telegram integration
- `GET /api/telegram` - Get integrations
- `PUT /api/telegram/:id` - Update integration
- `DELETE /api/telegram/:id` - Delete integration

## User Flow

1. **Registration/Login**: Users authenticate through Telegram
2. **Interview Management**: Add, view, and manage interview results
3. **Statistics**: View interview success rates and analytics
4. **Settings**: Configure bot preferences and integrations

## Error Handling

The bot includes comprehensive error handling:
- API connection errors
- Authentication failures
- Invalid user input
- Network timeouts
- Graceful shutdown

## Logging

Configurable logging levels:
- `error` - Only errors
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Detailed debugging information

## Security

- JWT token-based authentication
- Input validation and sanitization
- Admin-only commands protection
- Secure environment variable handling

## Development

### Code Style
- TypeScript strict mode
- ESLint configuration
- Consistent error handling
- Comprehensive logging

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Deployment

### Using Docker (Recommended)
```bash
docker build -t wlnx-telegram-bot .
docker run -d --env-file .env wlnx-telegram-bot
```

### Manual Deployment
1. Build the project: `npm run build`
2. Set production environment variables
3. Start: `npm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License

## Support

For support and questions, contact the development team or create an issue in the repository.
