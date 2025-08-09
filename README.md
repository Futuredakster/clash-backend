# Clash Backend API

A Node.js/Express backend API for the Clash tournament management system.

## Features

- User authentication and authorization
- Tournament management
- Bracket generation and management
- Real-time updates with Socket.IO
- File upload handling with Cloudinary
- Email notifications
- MySQL database with Sequelize ORM

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO
- **File Storage**: Cloudinary
- **Email**: SendGrid/Nodemailer
- **Development**: Nodemon

## Prerequisites

- Node.js (v14 or higher)
- MySQL database
- npm or yarn package manager

## Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd clash-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=your_email@domain.com

# Server Configuration
PORT=3001
NODE_ENV=development
```

4. Set up your database and run migrations if needed

5. Start the development server:
```bash
npm start
```

The server will start on `http://localhost:3001` by default.

## API Endpoints

### Authentication
- `POST /accounts/login` - User login
- `POST /accounts/register` - User registration
- `GET /accounts/info` - Get account information

### Users
- `GET /users` - Get user information
- `PUT /users` - Update user information

### Tournaments
- `GET /tournaments` - Get all tournaments
- `POST /tournaments` - Create new tournament
- `PUT /tournaments/:id` - Update tournament
- `DELETE /tournaments/:id` - Delete tournament

### Brackets
- `GET /brackets/:tournamentId` - Get tournament brackets
- `POST /brackets` - Create bracket
- `PUT /brackets/:id` - Update bracket

### Participants
- `GET /participants/:tournamentId` - Get tournament participants
- `POST /participants` - Add participant
- `PUT /participants/:id` - Update participant
- `DELETE /participants/:id` - Remove participant

## Project Structure

```
├── config/           # Database and app configuration
├── middlewares/      # Express middlewares
├── models/          # Sequelize models
├── routes/          # API routes
├── socket/          # Socket.IO handlers
├── uploads/         # File upload directory
├── utils/           # Utility functions
├── index.js         # Main application file
└── package.json     # Dependencies and scripts
```

## Environment Variables

Make sure to set up all required environment variables in your `.env` file. See the Installation section for a complete list.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request

## License

This project is licensed under the ISC License.
