const user = JSON.parse(localStorage.getItem("user"));

const loginBtn = document.getElementById("login-btn");

if(user){

    loginBtn.innerHTML = "Dashboard";

    loginBtn.onclick = function(){

        window.location.href = "dashboard.html";

    };

}