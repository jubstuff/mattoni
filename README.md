# Mattoni

A simple, private budgeting app for your household. Budget like you're building a house—brick by brick.

*Mattoni* means "bricks" in Italian.

## Features

- **Hierarchical Budget Structure**: Organize your budget into Sections → Groups → Components
- **Monthly View**: See all 12 months at a glance with automatic totals
- **Excel-like Editing**:
  - Keyboard navigation (Arrow keys, Tab)
  - Fill handle to drag and copy values across months
- **Auto-save**: Changes are automatically saved when switching between items
- **Privacy-first**: All data stored locally, no cloud, no tracking
- **Desktop App**: Native macOS app (Windows/Linux coming soon)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: SQLite (better-sqlite3)
- **Desktop**: Electron

## Quick Start

### Desktop App (Recommended)

Download the latest release from the [Releases page](https://github.com/jubstuff/mattoni/releases).

### Development

```bash
# Clone the repository
git clone https://github.com/jubstuff/mattoni.git
cd mattoni

# Install all dependencies
npm run install:all

# Start development servers (web version)
npm run dev
```

The web app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Electron Development

```bash
# Install electron dependencies
npm run electron:install

# Run electron app in dev mode
npm run electron:dev

# Build .dmg for macOS
npm run electron:dist
```

## Project Structure

```
mattoni/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api/            # API client
│   │   └── types/          # TypeScript types
│   └── package.json
├── server/                 # Express backend (web version)
│   ├── src/
│   │   ├── routes/         # API routes
│   │   └── db/             # Database setup
│   ├── data/               # SQLite database location
│   └── package.json
├── electron/               # Electron desktop app
│   ├── main.ts             # Main process with embedded server
│   ├── icons/              # App icons
│   └── package.json
├── landing/                # Landing page (mattoni.trapai.com)
├── docker-compose.yml      # Docker deployment
├── Dockerfile              # Docker image
└── package.json            # Root package with scripts
```

## Deployment

### Docker (Web Version)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t mattoni .
docker run -p 3001:3001 -v budget-data:/app/server/data mattoni
```

### Coolify

1. Connect your Git repository to Coolify
2. Select "Docker Compose" as the build pack
3. Deploy - Coolify will use the `docker-compose.yml` automatically

## Data Model

```
Section (e.g., "Income", "Expenses")
  └── Group (e.g., "Employment", "Housing")
        └── Component (e.g., "Salary", "Rent")
              └── Monthly Values (Jan-Dec for each year)
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
