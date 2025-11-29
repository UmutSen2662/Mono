const { shuffle } = require("./utils");

function setUpDeck() {
    let deck = [];
    ["r", "g", "b", "y"].forEach((color) => {
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "p", "s", "r"].forEach((type) => {
            deck.push(color + type + "0");
            deck.push(color + type + "1");
        });
    });
    for (let i = 0; i < 4; i++) {
        deck.push("sp" + i);
        deck.push("sc" + i);
    }
    return shuffle(deck);
}

function discardToDeck(room) {
    if (!room) return;
    const oldDiscard = room.discard.slice(0, -1);
    const topCard = room.discard[room.discard.length - 1];

    const recycledCards = oldDiscard.map((c) => c.substring(0, 3));
    room.deck.push(...recycledCards);
    room.discard = [topCard];
    shuffle(room.deck);
}

function isPlayable(topCard, card) {
    if (card[0] === "s") return true;

    let activeTop = topCard;
    if (activeTop.length === 4) {
        activeTop = activeTop[3] + activeTop.substring(1);
    }

    return card[0] === activeTop[0] || card[1] === activeTop[1];
}

function botPickColor(hand) {
    const counts = {};
    hand.forEach((card) => {
        const color = card[0];
        counts[color] = (counts[color] || 0) + 1;
    });

    let maxColor = "";
    let maxCount = -1;

    Object.entries(counts).forEach(([color, count]) => {
        if (count > maxCount) {
            maxCount = count;
            maxColor = color;
        }
    });

    if (maxColor && maxColor !== "s") return maxColor;
    return ["r", "g", "b", "y"][hand.length % 4];
}

function executeBotTurn(room) {
    const current = room.players[room.current_player];
    let topCard = room.discard[room.discard.length - 1];
    let skip = 1;
    let played = false;

    // 1. Check for Draw 4 Stack (sp)
    if (topCard.substring(0, 2) === "sp" && room.plus > 1) {
        const cardIndex = current.hand.findIndex((c) => c.substring(0, 2) === "sp");
        if (cardIndex !== -1) {
            const card = current.hand.splice(cardIndex, 1)[0];
            const playedCard = card + botPickColor(current.hand);
            room.discard.push(playedCard);
            room.state = "p4";
            room.plus += room.plus !== 1 ? 4 : 3;
            played = true;
        }
    }
    // 2. Check for Draw 2 Stack (p)
    else if (topCard[1] === "p" && room.plus > 1) {
        const cardIndex = current.hand.findIndex((c) => c[1] === "p" && c[0] !== "s");
        if (cardIndex !== -1) {
            const card = current.hand.splice(cardIndex, 1)[0];
            room.discard.push(card);
            room.state = "p2";
            room.plus += room.plus !== 1 ? 2 : 1;
            played = true;
        }
    }
    // 3. Normal Play
    else {
        if (topCard.length === 4) topCard = topCard[3] + ".";

        // Try regular card
        let cardIndex = current.hand.findIndex((c) => (c[0] === topCard[0] || c[1] === topCard[1]) && c[0] !== "s");

        if (cardIndex !== -1) {
            const card = current.hand.splice(cardIndex, 1)[0];
            room.state = "n";
            if (card[1] === "s") skip = 2;
            else if (card[1] === "r") room.reversed = !room.reversed;
            else if (card[1] === "p") {
                room.plus += room.plus !== 1 ? 2 : 1;
                room.state = "p2";
            }
            room.discard.push(card);
            played = true;
        }

        // Try wild card
        if (!played) {
            cardIndex = current.hand.findIndex((c) => c[0] === "s");
            if (cardIndex !== -1) {
                const card = current.hand.splice(cardIndex, 1)[0];
                room.state = "n";
                const playedCard = card + botPickColor(current.hand);
                if (playedCard[1] === "p") {
                    room.plus += room.plus !== 1 ? 4 : 3;
                    room.state = "p4";
                }
                room.discard.push(playedCard);
                played = true;
            }
        }
    }

    // 4. Draw Card if needed
    if (!played) {
        if (room.deck.length < room.plus + 1) discardToDeck(room);
        const cardsDrawn = room.deck.splice(-room.plus);
        current.hand.push(...cardsDrawn);
        room.state = "n";
        room.plus = 1;
    }

    // 5. Check Win
    if (current.hand.length === 0) {
        return { won: true };
    }

    return { won: false, skip: skip };
}

module.exports = { setUpDeck, discardToDeck, isPlayable, botPickColor, executeBotTurn };
