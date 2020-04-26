function promptChangeNameModal() {
  modalPrompt("What would you like your new name to be?", "My Name...", "Confirm", "Cancel", "changeName()");
}

function changeName() {
  username = document.getElementById("modalInput").value;
  closeModal();
  // Change server data / Other player data
  socket.emit('change username', username);
}

// Speed
let style_bg_color = 'White';
let style_sysMsg_color= "grey";
let style_msg_color = "black";
let style_button_text = 'Dark mode';

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
