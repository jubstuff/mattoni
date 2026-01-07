# Personal Budget

A simple, self-hosted personal finance budgeting application inspired by [Brixx](https://brixx.com). Track your income and expenses with a hierarchical structure and monthly breakdown.

## Features

- **Hierarchical Budget Structure**: Organize your budget into Sections → Groups → Components
- **Monthly View**: See all 12 months at a glance with automatic totals
- **Excel-like Editing**:
  - Keyboard navigation (Arrow keys, Tab)
  - Fill handle to drag and copy values across months
- **Auto-save**: Changes are automatically saved when switching between items
- **SQLite Database**: All data stored locally, no external services required

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: SQLite (better-sqlite3)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/personal-budget.git
cd personal-budget

# Install all dependencies
npm run install:all

# Start development servers
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Project Structure

```
personal-budget/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api/            # API client
│   │   └── types/          # TypeScript types
│   └── package.json
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   └── db/             # Database setup
│   ├── data/               # SQLite database location
│   └── package.json
├── docker-compose.yml      # Docker deployment
├── Dockerfile              # Docker image
└── package.json            # Root package with scripts
```

## Deployment

### Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t personal-budget .
docker run -p 3001:3001 -v budget-data:/app/server/data personal-budget
```

### Coolify

1. Connect your Git repository to Coolify
2. Select "Docker Compose" as the build pack
3. Deploy - Coolify will use the `docker-compose.yml` automatically

### Manual Production Build

```bash
# Build frontend
cd client && npm run build

# Start production server
cd ../server && npm run build && npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sections` | Get all sections with groups and components |
| POST | `/api/sections` | Create a new section |
| PUT | `/api/sections/:id` | Update a section |
| DELETE | `/api/sections/:id` | Delete a section |
| POST | `/api/groups` | Create a new group |
| PUT | `/api/groups/:id` | Update a group |
| DELETE | `/api/groups/:id` | Delete a group |
| POST | `/api/components` | Create a new component |
| PUT | `/api/components/:id` | Update a component |
| DELETE | `/api/components/:id` | Delete a component |
| GET | `/api/budget/:year` | Get budget values for a year |
| PUT | `/api/budget/component/:id` | Update component values |

## Data Model

```
Section (e.g., "Revenues", "Costs")
  └── Group (e.g., "Salary", "Housing")
        └── Component (e.g., "Main Job", "Rent")
              └── Monthly Values (Jan-Dec for each year)
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
