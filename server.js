var express = require('express');
var app = express();
var path = require('path');
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var Data = require("./server/Data.js");
var Globals = require("./server/Globals.js");
var HC = require("./server/HandComparer.js");
var nextUserId = 0;
var numUsers = 0;
var msgNum = 0;
let round_data = {
  cards: null,
  board: [],
  currentBet: 0,
  phase: "PREFLOP",
}
let state;

// Routing
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  res.sendFile(__dirname+'/public/client.html');
});

app.get('/topsecretserver', function(req, res){
  res.sendFile(__dirname+'/public/server.html');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

io.on('connection', (socket) => {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    let return_data = {
      username: socket.username,
      message: data,
      messageId: msgNum++,
    };
    socket.broadcast.emit('new message', return_data);
    // Add message to data
    Data.messages[return_data.messageId] = return_data;
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username, hasSpaceCallback) => {
    if (addedUser) return;
    if (numUsers >= 9) {
      hasSpaceCallback(false);
      return;
    } else {
      hasSpaceCallback(true);
    }
    // Add Data
    socket.userId = nextUserId++;
    let allPositions = [0,1,2,3,4,5,6,7,8];
    let position = Math.min(...allPositions.filter(x => !Data.positions.includes(x)));

    Data.positions.push(position);

    let playerData = {
      userId: socket.userId,
      username: username,
      position: position,
      chips: Globals.STARTING_CHIPS,
      bet: 0,
      totalBet: 0,
      card1: null,
      card2: null,
      status: "READY",
      round_status: "WAITING",
    };
    numUsers++;
    Data.players[socket.userId] = playerData;

    // we store the username in the socket session for this client
    socket.username = username;
    addedUser = true;
    socket.emit('login', {
      userId: socket.userId,
      numUsers: numUsers,
    });

    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });

    // Add this player to all players
    io.emit('update player', ['add'], playerData);

    // Add all other players to this socket
    for (let key in Data.players) { let player = Data.players[key];
      if (player.userId != socket.userId) {
        socket.emit('update player', ['add'], player);
      }
    }
  });

  // when the client emits 'change username', this listens and executes
  socket.on('change username', (username) => {

    // we store the username in the socket session for this client
    let old_username = socket.username;
    socket.username = username;
    Data.players[socket.userId].username = username;

    // Tell the user they changed their name (CHAT)
    socket.emit('change username', {
      new_username: username,
      old_username: old_username,
    });
    // Tell the other users a name was changed (CHAT)
    socket.broadcast.emit('username changed', {
      new_username: username,
      old_username: old_username,
    });

    // GAME
    io.emit('update player', ['username'], Data.players[socket.userId]);
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;
      // Alert Players that players are gone
      io.emit('update player', ['remove'], Data.players[socket.userId]);
      // Free Position
      Data.positions = Data.positions.filter(x => x != Data.players[socket.userId].position);
      // Delete Player Data
      delete Data.players[socket.userId];

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

  // Data getters
  socket.on('get players data', (fn) => {
    fn(Data.players);
  });

  socket.on('get messages data', (fn) => {
    fn(Data.messages);
  });

  socket.on('get game data', (fn) => {
    fn(Data.game);
  });

  socket.on('get positions data', (fn) => {
    fn(Data.positions);
  });

  // Server EVENTS
  socket.on('set chip amount', (id, value) => {
    Data.players[id].chips = value;
    io.emit('update player', ['chips'], Data.players[id]);
  });

  socket.on('start game', () => {
    console.log("Starting Game!");
    game_startGame();
  });



  // Client Events
  socket.on('player action', (position, action) => {
    io.emit('end turn', position);
    game_continueBettingRound(position, action);
  });
});


// GAME DATA AND FUNCTIONS
function game_startGame() {
  game_startHand(true);
}
// todo add startRound function
function game_startHand(first) {
  game_setPlayersReady();
  console.log("Starting Hand with "+game_getNumPlayersWithStatus(["READY"])+ " players");
  game_setReadyPlayersIN();
  let numINPlayers = game_getNumPlayersWithStatus(["IN"]);
  if (numINPlayers < 2) {
    return;
  }
  // Clean-up / Reset
  // PLAYER - BETS, CARDS, POT, etc...
  //resetPot();
  // Set Dealer Chip
  if (first) {
    // Randomize or jsut 0 +improve
    Data.game.dealerPosition = Globals.STARTING_DEALER_POSITION; // +todo - Randomize this to start then have it progress
  } else {
    Data.game.dealerPosition = game_getNextINPlayerPosition(Data.game.dealerPosition);
  }
  io.emit('update game', ['dealer button'], Data.game);

  // Reset Round Data
  round_data = {
    cards: null,
    board: [],
    currentBet: 0,
    phase: "PREFLOP",
  };
  round_data.cards = sys_getShuffledDeck();

  let smallBlindPosition = game_getSmallBlindPosition(Data.game.dealerPosition, numINPlayers);
  let bigBlindPosition = game_getBigBlindPosition(Data.game.dealerPosition, numINPlayers);

  // Blinds
  player_smallBlind(help_getKeyFromPosition(smallBlindPosition));
  player_bigBlind(help_getKeyFromPosition(bigBlindPosition));
  round_data.currentBet = Data.game.bigBlindAmount;
  // Deal
  game_dealCards();
  // Turns
  // Betting Round
  game_startBettingRound(true);
}

function game_dealCards() {
  for (let key in Data.players) {
    let card1 = round_data.cards.pop();
    let card2 = round_data.cards.pop();

    Data.players[key].card1 = card1;
    Data.players[key].card2 = card2;

    io.emit('update player', ['cards'], Data.players[key]);
  }
}

function game_startBettingRound(preFlop) {
  let numINPlayers = game_getNumPlayersWithStatus(["IN", "ALL IN"]);
  console.log("Number of players 'IN': "+ numINPlayers);
  if (numINPlayers == 1) {
    console.log("ENDING phase: "+round_data.phase+"!");
    game_endRound(round_data.phase);
    return;
  }

  for (let key in Data.players) { let player = Data.players[key];
    Data.players[key].round_status = "WAITING";
    if (!preFlop) {
      game_clearPlayerBets();
      round_data.currentBet = 0;
    }
  }
  // Get first player
  let currentPosition = game_getStartingPosition(preFlop, numINPlayers);
  console.log("Starting betting round on: " + currentPosition);

  // Let them act
  // State needs to tell the player what the current bet is,
  state = {
    bet: round_data.currentBet,
    timeout: Globals.TURN_TIMEOUT,
    bigBlind: Data.game.bigBlindAmount,
    phase: round_data.phase,
  }

  io.emit('player turn', currentPosition, Data.players[help_getKeyFromPosition(currentPosition)], state);
  // tell player (update gui)
  // continueBettingRound(currentPlayer, "BET"+globals.bigBlindAmount); // Actions like CHECK or BET######
  // wait for response (client will timeout (in current version) or x seconds)
  // handle response and update state then do the same for the next player
  // Update state of things
  // next_player
  // update state of things
  // players left to act?...
}

function game_continueBettingRound(position, action) {
  console.log(`Player at position: ${position}, chose to ${action}`);
  let key = help_getKeyFromPosition(position);
  Data.players[key].round_status = "ACTED";

  // Evaluate player action
  if (action === "FOLD") {
    player_fold(key);
  } else if (action === "CHECK") {
    player_check(key);
  } else if (action === "CALL") {
    player_call(key);
  } else if (action === "ALL IN") {
    player_allIn(key);
  } else {
    // BET
    // Could be ALL IN (todo)
    player_bet(key, parseInt(action.substring(3)));
  }
  let numRemainingPlayers = game_getNumPlayersWithStatus(["IN", "ALL IN"]);
  if (numRemainingPlayers == 1) {
    game_handWinner(game_getPlayersWithStatus(["IN", "ALL IN"])[0]);
    return;
  }

  // Get next player to act (If there is one) or end betting round and continue the game.
  let [nextPosition, nextPlayer] = game_getNextPlayerToAct(position);
  if (nextPlayer === null) {
    // No Players left to ACT
    console.log("ENDING phase: "+round_data.phase+"!");
    game_endRound(round_data.phase);
  } else {
    // This player hasn't gone yet
    state = {
      bet: round_data.currentBet,
      timeout: Globals.TURN_TIMEOUT,
      bigBlind: Data.game.bigBlindAmount,
      phase: round_data.phase,
    }
    io.emit('player turn', nextPosition, nextPlayer, state);
  }
}

function game_endRound(phase) {
  switch(phase) {
    case "PREFLOP":
      // Deal Flop
      game_dealFlop();
      // Start Flop round
      round_data.phase = "FLOP";
      break;
    case "FLOP":
      // Deal turn
      game_dealTurn();
      // Start turn round
      round_data.phase = "TURN";
      break;
    case "TURN":
      // Deal River
      game_dealRiver();
      // Start river round
      round_data.phase = "RIVER";
      break;
    case "RIVER":
      // SHOWDOWN
      log("log", "SHOWDOWN");

      // Get remaining players data (or hands)
      let candidates = game_getPlayersWithStatus(["IN", "ALL IN"]);
      //Compare them and get the winning hand (or key)
      let comparer = new HC.HandComparer(Data.game.board);
      let [winners, winner_data] = comparer.getWinnerKeys(candidates);

      console.log("Winners: "+ winners);
      console.log(winners);

      // Award winner, (show hands),
      // todo split pots
      if (winners.length === 1) {
        game_handWinner(winners[0], winner_data);
      } else {
        // Multiple winners.
        // Give first max amount
        // (if pot not empty, give next winner max amount, repeat)
        // Pot empty, all winners paid, round over
      }
      return;
      break;
    default:
      console.log("Phase: "+phase+" has no action.");
      return;
      break;
  }
  sys_sleep(Globals.POST_DEAL_SLEEP_TIME);
  console.log("Starting Round: "+round_data.phase);
  // Clean up bets
  game_startBettingRound(false);
}

function game_handWinner(winnerKey, winner_data) {
  // FIRST WINNER (TAKE MAX FROM POT AND REPEAT)
  let player = Data.players[winnerKey];
  console.log(winner_data);
  log('log', winner_data);
  //log("The winner is "+player.username+"!");
  if (winner_data != undefined) {
    log('sys', player.username+" wins $"+Data.game.pot+" with a "+winner_data.hand_name+"!");
  } else {
    log('sys', player.username+" wins $"+Data.game.pot+"! All other players folded.");
  }


  // Give out pot to winner
  Data.players[winnerKey].chips += Data.game.pot;
  Data.game.pot = 0;

  io.emit('update player', ['chips'], Data.players[winnerKey]);
  io.emit('update game', ['pot'], Data.game);
  // Start Next Hand
  game_endHand();
}

function game_endHand() {
  // Clear cards
  game_clearBoardCards();
  game_clearPlayerCards();
  // reset info?
  game_clearPlayerBets();
  game_clearPlayerTotalBets();
  // Incriment hand count

  // Bust broke players
  game_bustBrokePlayers();

  game_startHand(false);
}

// Dealing Functions
function game_dealFlop() {
  log('log', "Dealing Flop");
  // Burn Card
  let burnCard = round_data.cards.pop();
  // Deal 1, 2, 3
  let flop1 = round_data.cards.pop();
  let flop2 = round_data.cards.pop();
  let flop3 = round_data.cards.pop();

  Data.game.board[0] = burnCard;
  Data.game.board[1] = flop1;
  Data.game.board[2] = flop2;
  Data.game.board[3] = flop3;

  let cards = [burnCard, flop1, flop2, flop3];
  io.emit('deal flop', cards);
}
function game_dealTurn() {
  log('log', "Dealing Turn");
  // Burn Card
  let burnCard = round_data.cards.pop();
  // Deal 1, 2, 3
  let turn = round_data.cards.pop();

  Data.game.board[4] = burnCard;
  Data.game.board[5] = turn;

  let cards = [burnCard, turn];
  io.emit('deal turn', cards);
}
function game_dealRiver() {
  log('log', "Dealing River");
  // Burn Card
  let burnCard = round_data.cards.pop();
  // Deal 1, 2, 3
  let river = round_data.cards.pop();

  Data.game.board[6] = burnCard;
  Data.game.board[7] = river;

  let cards = [burnCard, river];
  io.emit('deal river', cards);
}

function game_clearPlayerBets() {
  for (let key in Data.players) { let player = Data.players[key];
    Data.players[key].bet = 0;
    io.emit('update player', ['bet'], Data.players[key]);
  }
}
function game_clearPlayerTotalBets() {
  for (let key in Data.players) { let player = Data.players[key];
    Data.players[key].totalBet = 0;
    io.emit('update player', ['bet'], Data.players[key]);
  }
}
function game_clearPlayerCards() {
  for (let key in Data.players) { let player = Data.players[key];
    Data.players[key].card1 = null;
    Data.players[key].card2 = null;
    io.emit('update player', ['cards'], Data.players[key]);
  }
}
function game_clearBoardCards() {
  Data.game.board = [];
  io.emit('update game', ['board'], Data.game);
}
function game_bustBrokePlayers() {
  for (let key in Data.players) { let player = Data.players[key];
    if (Data.players[key].chips == 0 && Data.players[key].status != "BUST") {
      Data.players[key].status = "BUST";
      io.emit('update player', ['status'], Data.players[key]);
    }
  }
}

// GAME HELPER FUNCTIONS
function game_setReadyPlayersIN() {
  for (let key in Data.players) { let player = Data.players[key];
    if (player.status === "READY") {
      Data.players[key].status = "IN";
    }
  }
}

function game_setPlayersReady() {
  for (let key in Data.players) { let player = Data.players[key];
    if (player.status != "BUST" && player.status != "SITTING_OUT") {
      Data.players[key].status = "READY";
    }
  }
}

function game_getStartingPosition(preFlop, numINPlayers) {
  if (preFlop && numINPlayers == 2) {
    return (Data.game.dealerPosition);
  }
  let distance = preFlop ? 3 : 1;
  return help_getPositionFromPositionAndDistance(Data.game.dealerPosition, distance);
}
function game_getNextINPlayerPosition(currPosition) {
  return help_getPositionFromPositionAndDistance(currPosition, 1);
}

function game_getSmallBlindPosition(dealerPosition, numPlayers) {
  if (numPlayers == 2) {
    return dealerPosition;
  } else {
    return help_getPositionFromPositionAndDistance(dealerPosition, 1);
  }
}
function game_getBigBlindPosition(dealerPosition, numPlayers) {
  if (numPlayers == 2) {
    return help_getPositionFromPositionAndDistance(dealerPosition, 1);
  } else {
    return help_getPositionFromPositionAndDistance(dealerPosition, 2);
  }
}

function game_getNumPlayersWithStatus(stati) {
  if (stati.includes("ANY") || stati === undefined || stati === null) {
    return Object.keys(Data.players).length;
  }
  let count = 0;
  for (let key in Data.players) { let player = Data.players[key];
    if (stati.includes(player.status)) {
      count++
    }
  }
  return count;
}
function game_getPlayersWithStatus(stati) {
  let players = [];
  for (let key in Data.players) { let player = Data.players[key];
    if (stati === undefined || stati === null || stati.includes("ANY") || stati.includes(player.status)) {
      players.push(player);
    }
  }
  return players;
}

function game_getNextPlayerToAct(position) {
  let nextPosition = game_getNextINPlayerPosition(position);
  console.log("Next Player: Position: "+nextPosition);
  if (nextPosition === null) {
    return [null, null];
  }
  // Check if they've already acted (and have matched bet)
  let nextPlayer = Data.players[help_getKeyFromPosition(nextPosition)];
  if (nextPlayer.bet === round_data.currentBet && nextPlayer.round_status === "ACTED") {
    return [null, null];
  }
  return [nextPosition, nextPlayer];
}

// Helper FUNCTIONS
function help_getPlayersListSortedByPosition() {
  let players = Object.values(Data.players);
  let orderedPlayers = players.sort((a, b) => (a.position - b.position));
  return orderedPlayers;
}
function help_getPositionFromPositionAndDistance(currPosition, distance) {
  let orderedPlayers = help_getPlayersListSortedByPosition();
  let index = -1;
  count = 0;
  let found = false;
  let itrs = 0;
  while (itrs < 20) {
    index = (index+1)%orderedPlayers.length;
    if (!found && orderedPlayers[index].position === currPosition) {
      found = true;
      continue;
    }
    if (found) {
      if (orderedPlayers[index].status === "IN") {
        count++;
        if (count==distance) {
          return orderedPlayers[index].position;
        }
      }
    }
    itrs++;
  }
  return null;
}
function help_getKeyFromPosition(position) {

  for (let key in Data.players) { let player = Data.players[key];

    if (player.position == position) {
      return key;
    }
  }
  console.log("Player not Found at position: "+ position);
  error("Player Not Found By Position");
  return null;
}


// Player Actions
function player_fold(key) {
  Data.players[key].status = "FOLDED";
  Data.players[key].bet = 0;
  Data.players[key].totalBet = 0;
  io.emit('update player', ['status', 'bet'], Data.players[key]);
}
function player_check(key) {

}
function player_call(key) {
  player_bet(key, (round_data.currentBet - Data.players[key].bet));
}
function player_allIn(key) {
  player_bet(key, Data.players[key].chips);
  Data.players[key].status = "ALL IN";
  io.emit('update player', ['status'], Data.players[key]);
}
function player_bet(key, amount) {
  console.log("making bet");
  Data.players[key].chips -= amount;
  Data.players[key].bet += amount;
  Data.players[key].totalBet += amount;
  Data.game.pot += amount;
  round_data.currentBet = Data.players[key].bet;
  io.emit('update game', ['pot'], Data.game);
  io.emit('update player', ['chips', 'bet'], Data.players[key]);
}
function player_smallBlind(key) {
  let chips = Data.players[key].chips;
  let amount = Math.min(Data.game.smallBlindAmount, chips);
  if (amount === chips) {
    player_allIn(key);
  } else {
    player_bet(key, amount);
  }
}
function player_bigBlind(key) {
  let chips = Data.players[key].chips;
  let amount = Math.min(Data.game.bigBlindAmount, chips);
  if (amount === chips) {
    player_allIn(key);
  } else {
    player_bet(key, amount);
  }
}

// Log to client history
function log(type, message) {
  io.emit('log', type, message);
}

// General System Functions
function sys_getShuffledDeck () {
  let cards = [];
  var i;
  var j = 0;
  for (i = 2; i < 15; i++) {
    cards[j++] = "h" + i;
    cards[j++] = "d" + i;
    cards[j++] = "c" + i;
    cards[j++] = "s" + i;
  }
  let shuffledCards = [];
  var len = cards.length;
  for (var i = 0; i < len; i++) {
    let index = sys_getRandInt(0,cards.length-1);
    shuffledCards.push(cards.splice(index,1)[0]);
  }
  return shuffledCards;
}

function sys_getRandInt(min, max) {
    return (Math.floor(Math.random() * (max+1-min)) + min);
}

function sys_sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
