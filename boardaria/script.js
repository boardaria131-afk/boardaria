
const board = document.getElementById("board");
const handDiv = document.getElementById("hand");
const statusText = document.getElementById("status");
const endTurnBtn = document.getElementById("endTurn");

let currentPlayer = 1;
let selectedCard = null;

const hand = [
    { name: "Kreatur 1", power: 2 },
    { name: "Kreatur 2", power: 3 },
    { name: "Kreatur 3", power: 1 }
];

function initBoard() {
    for (let i = 0; i < 25; i++) {
        const tile = document.createElement("div");
        tile.classList.add("tile");
        tile.dataset.index = i;
        tile.addEventListener("click", () => placeCard(tile));
        board.appendChild(tile);
    }
}

function renderHand() {
    handDiv.innerHTML = "";
    hand.forEach((card, index) => {
        const cardDiv = document.createElement("div");
        cardDiv.classList.add("card");
        cardDiv.innerText = card.name + " (ATK: " + card.power + ")";
        cardDiv.addEventListener("click", () => {
            selectedCard = index;
            statusText.innerText = card.name + " ausgewählt.";
        });
        handDiv.appendChild(cardDiv);
    });
}

function placeCard(tile) {
    if (selectedCard === null) {
        statusText.innerText = "Wähle zuerst eine Karte!";
        return;
    }
    if (tile.classList.contains("occupied")) {
        statusText.innerText = "Feld ist bereits belegt!";
        return;
    }
    tile.classList.add("occupied");
    tile.innerText = hand[selectedCard].power;
    hand.splice(selectedCard, 1);
    selectedCard = null;
    renderHand();
}

endTurnBtn.addEventListener("click", () => {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    statusText.innerText = "Spieler " + currentPlayer + " ist am Zug.";
});

initBoard();
renderHand();
