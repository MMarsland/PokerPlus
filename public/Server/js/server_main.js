var socket = io();
var editingUserId;

$(function() {
  // Onload

  updatePlayerData(null, true);

  socket.on('log', (message) => {
    console.log(message); // +improve make a proper log window
  });

  // GAME UPDATES
  socket.on('update game', (updates, data) => {
    console.log("Updating game for: "+updates);
    if (updates.includes('pot')) {
    }
    if (updates.includes('dealer button')) {
    }
  });

  // PLAYER UPDATES
  socket.on('update player', (updates, data) => {
    // +improve modify instead of repeat
    updatePlayerData(null, true);
    /*
    console.log("Updating player for: "+updates);
    if (updates.includes('add')) {

    }
    if (updates.includes('username')) {
    }
    if (updates.includes('position')) {
    }
    if (updates.includes('chips')) {
    }
    if (updates.includes('bet')) {
    }
    if (updates.includes('cards')) {
    }
    if (updates.includes('status')) {
    }
    if (updates.includes('remove')) {
    }*/
  });
});

function updatePlayerData(data, fetch) {
  let data_area = document.getElementById("data-area");
  data_area.innerHTML = "";
  if (fetch) {
    socket.emit('get players data', function(playersData) {
      console.log(playersData);
      updatePlayerData(playersData, false);
      return;
    });
  }

  for (let key in data) { let player = data[key];
    data_area.innerHTML += `
    <div class="data-row">
      <div class="userId"><div class="title">UserId:</div><div class="value">${player.userId}</div></div>
      <div class="username"><div class="title">Username:</div><div class="value">${player.username}</div></div>
      <div class="position"><div class="title">Position:</div><div class="value">${player.position}</div></div>
      <div class="chips" onclick="setChips(${player.userId})"><div class="title">Chips:</div><div class="value">${player.chips}</div></div>
      <div class="bet"><div class="title">Bet:</div><div class="value">${player.bet}</div></div>
      <div class="card1"><div class="title">Card1:</div><div class="value">${player.card1}</div></div>
      <div class="card2"><div class="title">Card2:</div><div class="value">${player.card2}</div></div>
      <div class="status"><div class="title">Status:</div><div class="value">${player.status}</div></div>
      <div class="round_status"><div class="title">Round_Status:</div><div class="value">${player.round_status}</div></div>
    </div>
    `;
  }

}

function setChips(id) {
  editingUserId = id;
  modalPrompt("What would you like to set the chips to?", "New chip amount...", "Set", "Cancel", "setChips_callback");
}

function setChips_callback(value) {
  socket.emit('set chip amount', editingUserId, value);
  editingUserId = null;
}


// Game FUNCTIONS
function start_game() {
  socket.emit('start game');
}
