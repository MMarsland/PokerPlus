function modalPrompt(messageText, placeholderText, confirmText, declineText, confirmFuncName) {
  let content = `
    <div class="msg-wrapper">${messageText}</div>
    <div class="input-wrapper">
      <input id="modalInput" placeholder="${placeholderText}"/>
    </div>
    <div class="button-wrapper">
      <button id="modal-confirm" class="confirm-button" onclick="modal_callback(${confirmFuncName}, 'modalInput')">${confirmText}</button>
      <button class="decline-button" onclick="closeModal()">${declineText}</button>
    </div>
  `;

  openModalWithContent(content);
}

function modal_callback(callback, inputId) {
  let input = undefined;
  if (inputId != undefined) {
    input = document.getElementById(inputId).value;
  }
  closeModal();
  callback(input);
}

function openModalWithContent(content) {
  var modal = document.getElementById("myModal");
  modal.style.display = "block";
  console.log(modal.children);
  modal.children[0].innerHTML = content;
  $currentInput = $('#modalInput');
  modalOpen = true;
}

function closeModal() {
  var modal = document.getElementById("myModal");
  modal.style.display = "none";
  modalOpen = false;
  $currentInput = $('.inputMessage').focus();
}

// When the user clicks anywhere outside of the modal, close it
window.onmousedown = function(event) {
  var modal = document.getElementById("myModal");
  if (event.target == modal) {
    modal.style.display = "none";
  }
}
