# Threat Detection Agent System

The **Threat Detection Agent System** is a sophisticated, multi-agent AI application designed to automate the process of threat intelligence gathering, analysis, and reporting. It leverages CrewAI for autonomous agent orchestration, FastAPI for a robust backend, and Next.js for a responsive, real-time frontend interface.

## 🚀 Features

- **Multi-Agent Architecture**: Utilizes specialized AI agents (Researcher, Analyst, Summarizer) powered by CrewAI to comprehensively investigate security threats, vulnerabilities, and incidents.
- **Real-time Thought Traces**: Streams agent thought processes and actions in real-time to the frontend via WebSockets, providing full transparency into the AI's reasoning.
- **Dynamic Configuration**: Automatically generates and customizes agent configurations based on the specified target asset and parameters.
- **Automated Reporting**: Generates detailed JSON-structured scan reports that can be directly emailed to stakeholders via Office 365 integration.
- **Background Scanning**: Scans are executed asynchronously as background tasks, allowing the user to continue using the application without blocking.
- **Ignored Sources Management**: Allows users to specify known URLs and incident summaries to skip, preventing duplicate alerts for already addressed issues.

## 🛠️ Technology Stack

### Backend
- **Framework**: FastAPI
- **AI Orchestration**: CrewAI, LangChain
- **Database**: PostgreSQL (via SQLAlchemy & psycopg2)
- **Dependency Management**: Poetry
- **Language**: Python 3.11+

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4, Radix UI primitives, Shadcn UI
- **Language**: TypeScript

### Deployment
- Docker & Docker Compose

## 📦 Installation & Setup

### Prerequisites
- Docker and Docker Compose (recommended for easy setup)
- Python 3.11+ (if running locally)
- Node.js 20+ (if running locally)

### Using Docker (Recommended)

The easiest way to run the entire stack is using Docker Compose.

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Threat_Detection_Agent_System
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the `backend` directory based on the provided `.env.example`:
   ```bash
   cp backend/.env.example backend/.env
   ```
   *Make sure to fill in your API keys (e.g., OpenAI API Key) and database credentials in the `.env` file.*

3. **Build and Start the Containers**:
   ```bash
   docker-compose up --build
   ```

4. **Access the Application**:
   - Frontend: `http://localhost:3000`
   - Backend API Docs: `http://localhost:8000/docs`

### Manual Setup (Local Development)

#### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies using Poetry:
   ```bash
   poetry install
   ```
3. Setup your `.env` file:
   ```bash
   cp .env.example .env
   ```
4. Run the FastAPI server:
   ```bash
   poetry run uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

#### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## 🏗️ System Architecture

1. **Client (Next.js)**: Users configure scans (asset, duration, attributes) and initiate them. The UI establishes a WebSocket connection to listen for real-time agent thoughts.
2. **API (FastAPI)**: Receives scan requests, manages database sessions, and kicks off background tasks.
3. **CrewAI Orchestrator**: Manages the lifecycle of the threat intelligence agents. Agents use custom tools to search the web, scrape content, and synthesize findings into a structured report.
4. **Database (PostgreSQL)**: Stores session histories, scan reports, agent configurations, thought traces, and user-defined ignored sources.

## 📝 License
[Specify License Here]
