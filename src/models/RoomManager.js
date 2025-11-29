const { generateRoomName } = require("../utils");
const MonoGame = require("./MonoGame");

class RoomManager {
    constructor() {
        this.rooms = {};
    }

    createRoom(id, name, password) {
        if (!name) name = generateRoomName();
        const newRoom = new MonoGame(id, name, password);
        this.rooms[id] = newRoom;
        return newRoom;
    }

    getRoom(id) {
        return this.rooms[id];
    }

    removeRoom(id) {
        delete this.rooms[id];
    }

    getAllRooms() {
        return Object.values(this.rooms);
    }

    cleanup() {
        Object.keys(this.rooms).forEach((key) => {
            if (this.rooms[key].players.length === 0) {
                delete this.rooms[key];
            }
        });
    }
}

module.exports = new RoomManager();
