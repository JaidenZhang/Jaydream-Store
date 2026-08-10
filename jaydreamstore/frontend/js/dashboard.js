const user = JSON.parse(localStorage.getItem("user"));

if(!user){

    window.location.href="login.html";

}

document.getElementById("username").innerHTML = user.username;

function logout(){

    localStorage.removeItem("user");

    window.location.href="login.html";

}