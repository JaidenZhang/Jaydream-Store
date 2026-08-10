const API = "http://127.0.0.1:5000";

async function register(){

    const username = document.getElementById("username").value;

    const email = document.getElementById("email").value;

    const password = document.getElementById("password").value;

    const response = await fetch(API + "/register",{

        method:"POST",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify({

            username,
            email,
            password

        })

    });

    const data = await response.json();

    alert(data.message);

    if(data.success){

        location.href="login.html";

    }

}