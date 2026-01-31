# Mono

A real-time multiplayer card game built with Node.js, Express, and Socket.io.

## Overview

Mono is a web-based implementation of the classic card game UNO, supporting multiple concurrent rooms, password protection, and AI opponents. The system uses WebSockets for real-time state synchronization between the server and clients.

## Features

- **Multiplayer:** Real-time gameplay via Socket.io.
- **AI Bots:** Automated opponents with configurable logic and simulated delays.
- **Room Management:** Support for creating and joining specific rooms with optional password protection.
- **Game Mechanics:** Implementation of card effects (Skip, Reverse, Draw) and penalty stacking (+2 and +4).
- **Session Support:** Persistence of player identity and room placement across reconnections.

## Setup and Installation

### Prerequisites

- Node.js (v14+)
- npm

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure environment variables in a `.env` file:
    ```env
    PORT=3000
    SESSION_SECRET=your_secret_key
    ```
4.  Start the server:
    ```bash
    npm start
    ```

## Project Structure

### Backend

- `server.js`: Entry point. Configures Express, sessions, and Socket.io.
- `src/models/MonoGame.js`: Core game engine. Manages deck logic, turn states, and win conditions.
- `src/models/RoomManager.js`: Handles room lifecycle and player assignment.
- `src/controllers/socketController.js`: Manages WebSocket event listeners and broadcasts.
- `src/routes.js`: Defines HTTP routes for the lobby and game rooms.

### Frontend

The frontend is built using EJS templates and vanilla JavaScript (Socket.io client).

- `views/`: Contains the server-side rendered templates.
    - `layout.ejs`: The base template containing shared HTML structure.
    - `index.ejs`: The lobby interface for creating and joining rooms.
    - `room.ejs`: The main game interface where gameplay occurs.
    - `partials/`: Reusable template components (e.g., `rooms_list.ejs`).
- `public/`: Static assets served to the client.
    - `index.css`, `room.css`, `styles.css`: Stylesheets for the different views.
    - `cards/`: SVG assets for each card type.
    - `audio/`: Sound effects for game events.
    - `options/`: UI icons for settings and controls.

## Gameplay Mechanics

- **Stacking:** Players can stack +2 and +4 cards to pass and increment the draw penalty.
- **Bots:** Bots can be added to fill rooms. They will automatically play valid cards or draw from the deck based on a heuristic logic.
- **Reconnection:** If a user disconnects, their spot is temporarily taken by an AI until they return or the game ends.

## License

MIT
