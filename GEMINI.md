# Mono - Multiplayer Card Game

## Project Overview
**Mono** is a real-time multiplayer card game inspired by Uno, built with Node.js. It supports multiple game rooms, real-time gameplay via WebSockets, and includes built-in AI bots. The game logic handles card validation, special card effects (Skip, Reverse, Draw 2/4), turn management, and win conditions.

## Tech Stack
*   **Runtime:** Node.js
*   **Web Framework:** Express.js
*   **Real-time Engine:** Socket.io
*   **Templating:** EJS (Embedded JavaScript templates)
*   **State Management:** In-memory game state (server-side)
*   **Styling:** Custom CSS (located in `public/`)

## Architecture
The application follows a variation of the MVC pattern:
*   **Models:** `MonoGame.js` (Game Logic) and `RoomManager.js` (Room Lifecycle).
*   **Views:** EJS templates in `views/` rendered by Express.
*   **Controllers:** `socketController.js` handles WebSocket events and bridges the client interactions with the game models. `routes.js` handles HTTP navigation.

### Key Components

#### 1. Game Engine (`src/models/MonoGame.js`)
This class encapsulates a single game session. It manages:
*   **State Machine:** Transitions between `LOBBY`, `PLAYING`, `p2` (stacking draw 2), `p4` (stacking draw 4), and `WIN`.
*   **Deck Management:** Shuffling, dealing, and recycling the discard pile.
*   **Card Logic:** Validates moves (`_isPlayable`), applies effects (Skip, Reverse), and handles wild card color picking.
*   **Bot AI:** A heuristic-based AI (`executeBotLogic`) that plays valid cards or draws if necessary.

#### 2. Real-time Communication (`src/controllers/socketController.js`)
Handles all Socket.io events:
*   `connection`/`disconnect`: Manages player sessions and room joining/leaving.
*   `player_ready`: Triggers game start checks.
*   `play_card`/`draw_card`: Executes moves on the `MonoGame` instance.
*   `room_update`: Broadcasts the entire game state to all clients in a room after every change.

## Setup & Running

### Prerequisites
*   Node.js (v14+ recommended)
*   npm

### Installation
```bash
npm install
```

### Configuration
Create a `.env` file (optional, defaults provided):
```env
PORT=3000
SESSION_SECRET=your_secret_key
```

### Start Server
```bash
npm start
```
The server will start on `http://localhost:3000`.

## Game Rules (Code Implementation Details)
*   **Card IDs:**
    *   Colors: `r` (Red), `g` (Green), `b` (Blue), `y` (Yellow).
    *   Types: `0-9`, `p` (+2), `s` (Skip), `r` (Reverse).
    *   Wilds: `sc` (Wild Change Color), `sp` (Wild +4).
*   **Stacking:** The engine supports stacking Draw 2 (`p2` state) and Draw 4 (`p4` state) cards. Players must play a matching draw card to pass the penalty to the next player.
*   **Bots:** Bots can be added in the lobby. They play automatically with a simulated delay based on their hand size.

## File Structure
*   `server.js`: Application entry point.
*   `src/models/MonoGame.js`: Core game logic and AI.
*   `src/controllers/socketController.js`: WebSocket event handlers.
*   `src/routes.js`: HTTP route definitions.
*   `public/`: Static assets (CSS, card SVGs, audio).
*   `views/`: EJS HTML templates.
