// Конфигурация
const API_BASE_URL = 'https://your-api-address.com'; // Бекенд адресі

// Глобальды айнымалылар
let tg = null;
let user = null;
let currentRoomId = null;
let gameState = null;
let selectedCard = null;

// Telegram WebApp инициализациясы
function initTelegramApp() {
    tg = window.Telegram.WebApp;
    tg.expand();
    
    user = {
        id: tg.initDataUnsafe.user?.id || 'test_user_' + Math.floor(Math.random() * 10000),
        username: tg.initDataUnsafe.user?.username || 'Test User'
    };
    
    console.log('User initialized:', user);
    initEventListeners();
    loadActiveRooms();
}

// Ивенттер
function initEventListeners() {
    document.getElementById('create-room-btn').addEventListener('click', createRoom);
    document.getElementById('join-room-btn').addEventListener('click', joinRoom);
    document.getElementById('pass-btn').addEventListener('click', passTurn);
    document.getElementById('take-btn').addEventListener('click', takeCards);
    document.getElementById('play-again-btn').addEventListener('click', resetGame);
}

// Бөлме құру
async function createRoom() {
    try {
        const response = await fetch(`${API_BASE_URL}/create_room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                username: user.username
            })
        });
        
        const data = await response.json();
        currentRoomId = data.room_id;
        showGameScreen();
        startGameLoop();
        
        tg.showAlert(`Бөлме құрылды! ID: ${currentRoomId}`);
    } catch (error) {
        console.error('Error creating room:', error);
        tg.showAlert('Бөлме құру кезінде қате пайда болды');
    }
}

// Бөлмеге қосылу
async function joinRoom() {
    const roomId = document.getElementById('room-id-input').value.trim();
    if (!roomId) {
        tg.showAlert('Бөлме ID енгізіңіз');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/join_room?room_id=${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id,
                username: user.username
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Қосылу кезінде қате пайда болды');
        }
        
        currentRoomId = roomId;
        showGameScreen();
        startGameLoop();
        tg.showAlert('Бөлмеге қосылдыңыз!');
    } catch (error) {
        console.error('Error joining room:', error);
        tg.showAlert(error.message);
    }
}

// Активті бөлмелерді жүктеу
async function loadActiveRooms() {
    try {
        const response = await fetch(`${API_BASE_URL}/active_rooms`);
        const data = await response.json();
        renderRoomsList(data.rooms);
    } catch (error) {
        console.error('Error loading rooms:', error);
    }
}

// Бөлмелер тізімін көрсету
function renderRoomsList(rooms) {
    const roomsList = document.getElementById('rooms-list');
    roomsList.innerHTML = '';
    
    if (rooms.length === 0) {
        roomsList.innerHTML = '<div class="list-group-item">Активті бөлмелер жоқ</div>';
        return;
    }
    
    rooms.forEach(room => {
        if (room.status === 'waiting') {
            const roomItem = document.createElement('button');
            roomItem.className = 'list-group-item list-group-item-action';
            roomItem.innerHTML = `
                <strong>Бөлме #${room.room_id}</strong>
                <div>Ойыншылар: ${room.players.map(p => p.username).join(', ')}</div>
                <small>Күтілуде...</small>
            `;
            roomItem.addEventListener('click', () => {
                document.getElementById('room-id-input').value = room.room_id;
            });
            roomsList.appendChild(roomItem);
        }
    });
}

// Ойын циклын бастау
function startGameLoop() {
    updateGameState();
    setInterval(updateGameState, 2000); // Әр 2 секунд сайын жаңарту
}

// Ойын күйін жаңарту
async function updateGameState() {
    if (!currentRoomId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/game_state/${currentRoomId}?user_id=${user.id}`);
        const state = await response.json();
        
        if (state.status === 'finished') {
            showGameOverScreen(state.winner_username);
            return;
        }
        
        gameState = state;
        renderGameState();
    } catch (error) {
        console.error('Error updating game state:', error);
    }
}

// Ойын күйін рендерлеу
function renderGameState() {
    if (!gameState) return;
    
    // Козыр картасы
    document.getElementById('trump-card').textContent = gameState.trump_card;
    
    // Ойын статусы
    document.getElementById('game-status').textContent = 
        gameState.status === 'waiting' ? 'Күтілуде...' : 'Ойын жүріп жатыр';
    
    // Кезектегі ойыншы
    const currentPlayer = gameState.players[gameState.attacker]?.username || 'Белгісіз';
    document.getElementById('player-turn').textContent = `Кезек: ${currentPlayer}`;
    
    // Қарсылас туралы ақпарат
    const opponentId = Object.keys(gameState.players).find(id => id !== user.id);
    const opponent = opponentId ? gameState.players[opponentId] : null;
    
    if (opponent) {
        document.getElementById('opponent-info').innerHTML = `
            <span>${opponent.username}</span>
            <span>Карталар: ${opponent.cards_count}</span>
        `;
    }
    
    // Үстелді рендерлеу
    renderTable();
    
    // Қолды рендерлеу
    renderHand();
    
    // Әрекеттер түймешіктерін баптау
    setupActionButtons();
}

// Үстелді рендерлеу
function renderTable() {
    const table = document.getElementById('game-table');
    table.innerHTML = '';
    
    if (!gameState.table || gameState.table.length === 0) {
        table.innerHTML = '<div class="text-center text-muted">Үстел бос</div>';
        return;
    }
    
    gameState.table.forEach(pair => {
        const pairElement = document.createElement('div');
        pairElement.className = 'd-flex justify-content-center mb-2';
        
        const attackCard = document.createElement('div');
        attackCard.className = 'card attack-card me-2';
        attackCard.textContent = pair.attack;
        pairElement.appendChild(attackCard);
        
        if (pair.defend) {
            const defendCard = document.createElement('div');
            defendCard.className = 'card defend-card';
            defendCard.textContent = pair.defend;
            pairElement.appendChild(defendCard);
        }
        
        table.appendChild(pairElement);
    });
}

// Қолды рендерлеу
function renderHand() {
    const handElement = document.getElementById('my-hand');
    handElement.innerHTML = '';
    
    if (!gameState.your_hand || gameState.your_hand.length === 0) {
        handElement.innerHTML = '<div class="text-muted">Карталар жоқ</div>';
        return;
    }
    
    gameState.your_hand.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = `card ${isTrumpCard(card) ? 'trump-suit' : ''}`;
        cardElement.textContent = card;
        
        if (selectedCard === card) {
            cardElement.classList.add('selected');
        }
        
        cardElement.addEventListener('click', () => {
            if (selectedCard === card) {
                selectedCard = null;
                cardElement.classList.remove('selected');
            } else {
                selectedCard = card;
                document.querySelectorAll('#my-hand .card').forEach(c => c.classList.remove('selected'));
                cardElement.classList.add('selected');
            }
        });
        
        handElement.appendChild(cardElement);
    });
}

// Әрекеттер түймешіктерін баптау
function setupActionButtons() {
    const isMyTurn = gameState.attacker === user.id || gameState.defender === user.id;
    const canPass = gameState.attacker === user.id && 
                   gameState.table.every(pair => pair.defend);
    const canTake = gameState.defender === user.id && 
                   gameState.table.some(pair => !pair.defend);
    
    document.getElementById('pass-btn').disabled = !isMyTurn || !canPass;
    document.getElementById('take-btn').disabled = !isMyTurn || !canTake;
}

// Картаны козыр екенін тексеру
function isTrumpCard(card) {
    if (!gameState || !card) return false;
    return card.slice(-1) === gameState.trump_suit;
}

// Өткізу әрекеті
async function passTurn() {
    if (!selectedCard && !canPassWithoutCard()) {
        tg.showAlert('Картаны таңдаңыз немесе өткізу мүмкін емес');
        return;
    }
    
    try {
        const move = {
            room_id: currentRoomId,
            user_id: user.id,
            action: 'pass',
            card: selectedCard
        };
        
        await makeMove(move);
        selectedCard = null;
    } catch (error) {
        console.error('Error passing turn:', error);
        tg.showAlert(error.message);
    }
}

// Карталарды алу әрекеті
async function takeCards() {
    try {
        const move = {
            room_id: currentRoomId,
            user_id: user.id,
            action: 'take'
        };
        
        await makeMove(move);
        selectedCard = null;
    } catch (error) {
        console.error('Error taking cards:', error);
        tg.showAlert(error.message);
    }
}

// Жүріс жасау
async function makeMove(move) {
    const response = await fetch(`${API_BASE_URL}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(move)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Әрекетті орындау кезінде қате пайда болды');
    }
    
    return response.json();
}

// Өткізу картасыз жасауға бола ма?
function canPassWithoutCard() {
    return gameState.table.length > 0 && 
           gameState.table.every(pair => pair.defend);
}

// Ойын аяқталды экраны
function showGameOverScreen(winnerUsername) {
    document.getElementById('game-screen').classList.add('d-none');
    document.getElementById('game-over-screen').classList.remove('d-none');
    
    const resultElement = document.getElementById('game-result');
    if (winnerUsername === user.username) {
        resultElement.textContent = 'Құттықтаймыз! Сіз жеңдіңіз!';
        resultElement.className = 'text-success';
    } else {
        resultElement.textContent = `Өкінішке орай, ${winnerUsername} жеңді`;
        resultElement.className = 'text-danger';
    }
}

// Ойынды қалпына келтіру
function resetGame() {
    document.getElementById('game-over-screen').classList.add('d-none');
    document.getElementById('auth-screen').classList.remove('d-none');
    currentRoomId = null;
    gameState = null;
    selectedCard = null;
    loadActiveRooms();
}

// Экрандарды ауыстыру
function showGameScreen() {
    document.getElementById('auth-screen').classList.add('d-none');
    document.getElementById('game-screen').classList.remove('d-none');
    document.getElementById('game-over-screen').classList.add('d-none');
}

// Telegram қосымшасын іске қосу
document.addEventListener('DOMContentLoaded', initTelegramApp);