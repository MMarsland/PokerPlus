// General Globals (todo/improve clean and tidy)
var username;
var connected = false;
var typing = false;
var lastTypingTime;
var mode = "light";
var $currentInput;
var modalOpen = false;
// Logged in Variables (globals) todo clean and tidy
var userId;
var global_position;
var num_of_players = 0;
var global_action = "WAITING";
let style_bg_color = 'White';
let style_sysMsg_color= "grey";
let style_msg_color = "black";
let style_button_text = 'Dark mode';
var socket = io();

// FUNCTIONS REQUIRED FOR LOGGING IN
$(function() {

  // Prompt for setting a username from the login page
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $loginPage = $('.login.page'); // The login page
  var $pokerPage = $('.poker.page'); // The chatroom page
  var $inputMessage = $('.inputMessage'); // Input message input box
  $currentInput = $usernameInput.focus();
  $pokerPage.hide();
  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });
  // Allow enter to log user in
  $window.keydown(event => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      setUsername();
    }
  });

  // Sets the client's username
  const setUsername = () => {
    username = sys_cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      // Tell the server your username
      socket.emit('add user', username, (allowed) => {
        if (allowed) {
          $loginPage.fadeOut();
          $pokerPage.fadeIn();
          $loginPage.off('click');
          $window.off('keydown');
          $currentInput = $inputMessage.focus();

          setUpSocketFunctions();
        } else {
          alert("The game is currently full! Please wait your turn!");
        }
      });
    }
  }
});

function setUpSocketFunctions() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $loginPage = $('.login.page'); // The login page
  var $pokerPage = $('.poker.page'); // The chatroom page
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box
  $currentInput = $inputMessage.focus();

  //toggleMode();
  const addParticipantsMessage = (data) => {
    var message = '';
    if (data.numUsers === 1) {
      message += "There's 1 participant";
    } else {
      message += "There are " + data.numUsers + " participants";
    }
    sysMsg(message);
  }

  // Sends a chat message
  const sendMessage = () => {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = sys_cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  const sysMsg = (message, options) => {
    var $el = $('<li>').addClass('sysMsg').text(message).attr('style', `color:${style_sysMsg_color}`);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  const addChatMessage = (data, options) => {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv)
      .attr('style', `color:${style_msg_color}`);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  const addChatTyping = (data) => {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  const removeChatTyping = (data) => {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  const addMessageElement = (el, options) => {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Updates the typing event
  const updateTyping = () => {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(() => {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  const getTypingMessages = (data) => {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  const getUsernameColor = (username) => {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // KEYBOARD EVENTS

  $window.keydown(event => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (modalOpen) {
        document.getElementById("modal-confirm").click();
      } else if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', () => {
    updateTyping();
  });

  // CLICK EVENTS

  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(() => {
    $inputMessage.focus();
  });

  // LOGIN AND OPTIONS SOCKET EVENTS

  // Whenever the server emits 'login', log the login message
  socket.on('login', (data) => {
    connected = true;
    userId = data.userId;
    // Display the welcome message
    var message = "Welcome to Poker Plus";
    sysMsg(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'change username', log the login message
  socket.on('change username', (data) => {

    // Display the personalized name change message
    var message = `You have chaged your username to ${data.new_username}`;
    sysMsg(message);
  });

  // Whenever the server emits 'username chagned', log the login message
  socket.on('username changed', (data) => {

    //Display the general name chagned message
    var message = `${data.old_username} has changed their name to ${data.new_username}`;
    sysMsg(message);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', (data) => {

    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', (data) => {
    sysMsg(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', (data) => {
    sysMsg(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', (data) => {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', (data) => {
    removeChatTyping(data);
  });

  socket.on('disconnect', () => {
    sysMsg('you have been disconnected');
    window.location.reload();
  });

  socket.on('reconnect', () => {
    sysMsg('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', () => {
    sysMsg('attempt to reconnect has failed');
  });

  socket.on('log', (message) => {
    log(message);
  });


  // GAME UPDATES
  socket.on('update game', (updates, data) => {
    console.log("Updating game for: "+updates);
    if (updates.includes('pot')) {
      gui_setPot(data.pot);
    }
    if (updates.includes('dealer button')) {
      gui_setDealerButtonLocation(int_getLocationByPosition(data.dealerPosition));
    }
    if (updates.includes('board')) {
      gui_setBoardCards(data.board);
    }
  });

  // PLAYER UPDATES
  socket.on('update player', (updates, data) => {
    console.log("Updating player for: "+updates);
    if (updates.includes('add')) {
      num_of_players++;
      if (data.userId === userId) {
        global_position = data.position;
      }
      addPlayer(data);
    }
    if (updates.includes('username')) {
      console.log("Updating username gui!");
      gui_setUsername(int_getLocationByPosition(data.position), data.username);
    }
    if (updates.includes('position')) {
      //+improve seat ordering! (Lots of gui for each player specific to this players position)
      if (data.userId === userId) {
        global_position = data.position;
      }
    }
    if (updates.includes('chips')) {
      gui_setChips(int_getLocationByPosition(data.position), data.chips);
    }
    if (updates.includes('bet')) {
      gui_setBet(int_getLocationByPosition(data.position), data.bet);
    }
    if (updates.includes('cards')) {
      gui_setCards(int_getLocationByPosition(data.position), data.card1, data.card2, (data.userId === userId), (data.status === "FOLDED"));
    }
    if (updates.includes('status')) {
      if (data.status === "FOLDED") {
        gui_foldPlayer(data);
      }
    }
    if (updates.includes('remove')) {
      gui_removeSeat(int_getLocationByPosition(data.position));
      num_of_players--;
    }
  });

  // TURN UPDATES
  socket.on('player turn', (position, playerData, state) => {
    // todo use playerData to present allowable options only and all in amounts
    if (playerData.userId === userId) {
      // This players turn
      // Show action and wait for response
      global_action = "WAITING";
      gui_highlightSeat(position, "gold");
      gui_showActionOptions(state, playerData.bet);
      game_startTurnTimeout(state);
    } else {
      // Some other players turns
      // Highlight the seat and start countdown bar... +Improve add bar
      gui_highlightSeat(position, "gold");
    }
  });

  socket.on('end turn', (position) => {
    gui_highlightSeat(position, "none");
  });

  // Card Dealing
  socket.on('deal flop', (cards) => {
    game_dealFlop(cards);
  });
  socket.on('deal turn', (cards) => {
    game_dealTurn(cards);
  });
  socket.on('deal river', (cards) => {
    game_dealRiver(cards);
  });
}

// Settings OPTIONS
function promptChangeNameModal() {
  modalPrompt("What would you like your new name to be?", "My Name...", "Confirm", "Cancel", "changeName");
}
function changeName(newUsername) {
  username = newUsername;
  // Change server data / Other player data
  socket.emit('change username', newUsername);
}
// Speed
function toggleMode() {

  if (mode === "light") {
    // To dark
    style_bg_color = 'DimGray';
    style_sysMsg_color = "white";
    style_msg_color = "white";

    style_button_text = 'Light mode';
    mode = "dark";
  } else {
    // To light
    style_bg_color = 'White';
    style_sysMsg_color = "grey";
    style_msg_color = "black";

    style_button_text = 'Dark mode';
    mode = "light";
  }
  document.getElementById("mode-button").innerHTML = style_button_text;

  document.body.style.backgroundColor = style_bg_color;
  let sysMsgs = document.getElementsByClassName("sysMsg");
  for (var i = 0; i < sysMsgs.length; i++) {
    sysMsgs[i].style.color = style_sysMsg_color;
  }
  let msgs = document.getElementsByClassName("message");
  for (var i = 0; i < msgs.length; i++) {
    msgs[i].style.color = style_msg_color;
  }

  // Other dark/light node things +improve
}
function openHelpWindow() {
  var url = "Client/help.html";
  var win = window.open(url, '_blank');
  win.focus();
}
function openRespectWindow() {
  var url = 'https://js-css-poker.sourceforge.io/';
  var win = window.open(url, '_blank');
  win.focus();
}


// GAME FUNCTIONS
function game_playerSendAction() {
  gui_hideActionOptions();
  socket.emit('player action', global_position, global_action);
}

function game_startTurnTimeout(state) {
  if (state.timeout === "NONE") {return;}
  setTimeout(function() {
    if (global_action === "WAITING") {
      global_action = (state.bet == 0) ? "CHECK": "FOLD";
      game_playerSendAction();
    }
  }, state.timeout);
}

// Card Dealing Functions
// todo make async
function game_dealFlop(cards) {
  console.log("Dealing Flop");
  // Burn
  gui_burn_board_card(0, cards[0]);
  // WAIT
  sys_sleep(300);
  // DEAL 1, wait, 2 wait, 3 wait,
  gui_lay_board_card(0, cards[1]);
  sys_sleep(300);
  gui_lay_board_card(1, cards[2]);
  sys_sleep(300);
  gui_lay_board_card(2, cards[3]);
}
function game_dealTurn(cards) {
  console.log("Dealing Turn");
  // Burn
  gui_burn_board_card(1, cards[0]);
  // WAIT
  sys_sleep(300);
  // DEAL
  gui_lay_board_card(3, cards[1]);
}
function game_dealRiver(cards) {
  console.log("Dealing River");
  // Burn
  gui_burn_board_card(2, cards[0]);
  // WAIT
  sys_sleep(300);
  // DEAL
  gui_lay_board_card(4, cards[1]);
}


// Action Options
function game_fold() {
  global_action = "FOLD";
  game_playerSendAction();
}
function game_check() {
  global_action = "CHECK";
  game_playerSendAction();
}
function game_call() {
  global_action = "CALL"; // TODO just bet?
  game_playerSendAction();
}
function game_raise() {
  modalPrompt("What would you like to raise to?", "The value of the total bet...", "Raise", "Cancel", "raise_callback");
}

function raise_callback(value) {
  global_action = "BET"+value; // TODO raise amount from other options
  game_playerSendAction();
}

// ADDING PLAYERS TO GUI (LOGIC) +improve
function addPlayer(data) {
  // +improve: change position to have main player at bottom
  gui_createSeat(int_getLocationByPosition(data.position), data.username, data.chips, data.userId);
}

// GUI FUNCTIONS
function gui_setDealerButtonLocation(location) {
  var button = document.getElementById('dealer-button');
  if (location < 0) {
    button.style.visibility = 'hidden';
  } else {
    button.style.visibility = 'visible';
  }
  button.className = 'seat' + location + '-button';
}

function gui_showActionOptions(state, currentBet) {
  let actionArea = document.getElementById("action_area");
  if (state.bet == 0 || state.bet === currentBet) {
    let callButtonDiv = document.getElementById("call-button");
    callButtonDiv.style.display = "none";
    let checkButtonDiv = document.getElementById("check-button");
    checkButtonDiv.style.display = "block";
  } else {
    let checkButtonDiv = document.getElementById("check-button");
    checkButtonDiv.style.display = "none";
    let callButtonDiv = document.getElementById("call-button");
    callButtonDiv.style.display = "block";
  }
  actionArea.style.visibility = 'visible';
}
function gui_hideActionOptions() {
  console.log("Hiding Action Area");
  let actionArea = document.getElementById("action_area");
  actionArea.style.visibility = 'hidden';
}

function gui_foldPlayer(data) {
  gui_setCards(int_getLocationByPosition(data.position), data.card1, data.card2, (data.userId === userId), true);
}

// Seat Operations
function gui_createSeat(location, name, chips, id) {
  let table = document.getElementById("poker_table");
  if (id === userId) {
    table.innerHTML += `
        <div id="seat${location}" class="seat" data.userId="${id}">
            <div class="holecards">
                <div class="card holecard1"></div>
                <div class="card holecard2"></div>
            </div>
            <div class="name-chips" style="height:35px; border: 1px solid gold;">
                <div class="player-name">${name}</div>
                <div class="chips">${chips}</div>
                <div class="userId" style="width:148px;">${id}</div>
            </div>
            <div class="bet"></div>
        </div>`;
  } else {
    table.innerHTML += `
        <div id="seat${location}" class="seat" data.userId="${id}">
            <div class="holecards">
                <div class="card holecard1"></div>
                <div class="card holecard2"></div>
            </div>
            <div class="name-chips">
                <div class="player-name">${name}</div>
                <div class="chips">${chips}</div>
                <div class="userId">${id}</div>
            </div>
            <div class="bet"></div>
        </div>`;
  }
}
function gui_removeSeat(location) {
  let table = document.getElementById("poker_table");
  let seatDiv = document.getElementById("seat"+location);
  table.removeChild(seatDiv);
}
function gui_setUsername(location, name) {
  let seatDiv = document.getElementById("seat"+location);
  let nameDiv = int_getFirstChildByClassName(seatDiv, 'player-name');
  nameDiv.innerHTML = name;
}
function gui_setCards(location, card1, card2, show, folded) {
  let seatDiv = document.getElementById("seat"+location);
  var card1Div = int_getFirstChildByClassName(seatDiv, 'card holecard1');
  var card2Div = int_getFirstChildByClassName(seatDiv, 'card holecard2');
  let opacity = folded ? 0.5 : 1.0;

  gui_setBackground(card1Div, int_GetCardImageUrl(card1, show), opacity);
  gui_setBackground(card2Div, int_GetCardImageUrl(card2, show), opacity);
}
function gui_setChips(location, chips) {

  let seatDiv = document.getElementById("seat"+location);
  let chipsDiv = int_getFirstChildByClassName(seatDiv, 'chips');
  chipsDiv.innerHTML = chips;
}
function gui_setBet(location, bet) {

  let seatDiv = document.getElementById("seat"+location);
  let betDiv = int_getFirstChildByClassName(seatDiv, 'bet');
  if (bet == null || bet == 0) {
    betDiv.textContent = ``;
  } else {
    betDiv.textContent = `Bet: $${bet} (${bet})`;
  }

}
function gui_highlightSeat(location, color) {
  let seatDiv = document.getElementById("seat"+location);
  let chipsDiv = int_getFirstChildByClassName(seatDiv, 'chips');
  let nameDiv = int_getFirstChildByClassName(seatDiv, 'player-name');
  nameDiv.style.backgroundColor = (color === "none") ? chipsDiv.style.backgroundColor : color;
  nameDiv.style.color = (color === "gold") ? 'black' : 'white';
}

// Game Operations
function gui_setPot(amount) {
    let pot = document.getElementById("pot");
    pot.innerHTML = "Pot: $"+amount;
}

// Board Cards
function gui_setBoardCards(cards) {
  gui_burn_board_card(0, cards[0]);    // Clear the burn1
  gui_lay_board_card(0, cards[1]);     // Clear the flop
  gui_lay_board_card(1, cards[2]);     // Clear the flop
  gui_lay_board_card(2, cards[3]);     // Clear the flop
  gui_burn_board_card(1, cards[4]);    // Clear the burn2
  gui_lay_board_card(3, cards[5]);     // Clear the turn
  gui_burn_board_card(2, cards[6]);    // Clear the burn3
  gui_lay_board_card(4, cards[7]);     // Clear the river
}
function gui_lay_board_card (n, the_card) {
  // Write the card no 'n'
  // the_card = "c9";

  var current = '';

  if (n === 0) {
    current = 'flop1';
  } else if (n === 1) {
    current = 'flop2';
  } else if (n === 2) {
    current = 'flop3';
  } else if (n === 3) {
    current = 'turn';
  } else if (n === 4) {
    current = 'river';
  }

  var table = document.getElementById('poker_table');
  var seatloc = table.children.board;

  var cardsdiv = seatloc.children[current];
  gui_setBackground(cardsdiv, int_GetCardImageUrl(the_card, true), 1);
}
function gui_burn_board_card (n, the_card) {
  // Write the card no 'n'
  // the_card = "c9";

  var current = '';

  if (n === 0) {
    current = 'burn1';
  } else if (n === 1) {
    current = 'burn2';
  } else if (n === 2) {
    current = 'burn3';
  }

  var table = document.getElementById('poker_table');
  var seatloc = table.children.board;

  var cardsdiv = seatloc.children[current];
  gui_setBackground(cardsdiv, int_GetCardImageUrl(the_card, false), 1);
}

// General GUI
function gui_setBackground(div, image, opacity) {
  var style = div.style;
  style.opacity = opacity;
  style["background-image"] = image;
}

// INTERNAL
function int_getFirstChildByClassName(current, name) {
  if (current.className === name) {
    return current;
  }
  var found = null;
  for (var i = 0; i < current.childNodes.length; i++) { let child = current.childNodes[i];
    found = int_getFirstChildByClassName(child, name);
    if (found != null) {
      break;
    }
  }
  return found;
}
function int_GetCardImageUrl (card, show) {

  if (card === undefined || card === "" || card === null) {
    return "";
  }
  if (!show) {
    return "url('../Shared/images/cardback.png')";
  }

  var suit = card.substring(0, 1);
  var rank = parseInt(card.substring(1));
  rank = int_FixTheRanking(rank); // 14 -> 'ace' etc
  suit = int_FixTheSuiting(suit); // c  -> 'clubs' etc

  return "url('../Shared/images/" + rank + "_of_" + suit + ".png')";
}
function int_FixTheRanking (rank) {
  var ret_rank = 'NoRank';
  if (rank === 14) {
    ret_rank = 'ace';
  } else if (rank === 13) {
    ret_rank = 'king';
  } else if (rank === 12) {
    ret_rank = 'queen';
  } else if (rank === 11) {
    ret_rank = 'jack';
  } else if (rank > 0 && rank < 11) {
    // Normal card 1 - 10
    ret_rank = rank;
  } else {
    console.log(typeof rank);
    alert('Unknown rank ' + rank);
  }
  return ret_rank;
}
function int_FixTheSuiting (suit) {
  if (suit === 'c') {
    suit = 'clubs';
  } else if (suit === 'd') {
    suit = 'diamonds';
  } else if (suit === 'h') {
    suit = 'hearts';
  } else if (suit === 's') {
    suit = 'spades';
  } else {
    alert('Unknown suit ' + suit);
    suit = 'yourself';
  }
  return suit;
}
function int_getLocationByPosition(position) {
  // +improve variaing seat orientiations to have player at bottom
  return position;
}

// SYSTEM FUNCTIONS
function sys_cleanInput(input) {
  return $('<div/>').text(input).html();
}
function sys_sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Non-game GUI
function log(message) {
  console.log(message);
  document.getElementById("logArea").innerHTML += `<li class="logMsg">${message}</li>`;
}


// todo remove the access to these helper functions (dev commands)
function startGame() {
  socket.emit('start game');
}
function getPlayers() {
  //
  socket.emit('get players data', function(playersData) {
    console.log(playersData);
  });
}
function getMessages() {
  //
  socket.emit('get messages data', function(messagesData) {
    console.log(messagesData);
  });
}
function getGame() {
  //
  socket.emit('get game data', function(gameData) {
    console.log(gameData);
  });
}
function getPositions() {
  //
  socket.emit('get positions data', function(positionsData) {
    console.log(positionsData);
  });
}

// TEST
function test() {
  let player = {
    money: 10,
    other: 20,
    name: "mike",
  }
  let name = player.name;
  console.log(player);
  console.log(name);
  name = "ted";
  player.name = "tom";
  console.log(name);
  console.log(player);
}
