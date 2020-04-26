function openSidenav() {
  document.getElementById("mySidenav").style.right = "0px";
  // transform toggle
  document.getElementById("mySidenavHandle").setAttribute('onclick', 'closeSidenav()');
  document.getElementById("mySidenavHandle").innerHTML = '<i class="arrow right"></i>';
}

function closeSidenav() {
  document.getElementById("mySidenav").style.right = "-300px";
  // transform toggle
  document.getElementById("mySidenavHandle").setAttribute('onclick', 'openSidenav()');
  document.getElementById("mySidenavHandle").innerHTML = '<i class="arrow left"></i>';
}
