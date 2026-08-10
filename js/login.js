const API = "http://127.0.0.1:5000";

async function login(){

    const email = document.getElementById("email").value;

    const password = document.getElementById("password").value;

    const response = await fetch(API + "/login",{

        method:"POST",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify({

            email,
            password

        })

    });

    const data = await response.json();

    alert(data.message);

    if(data.success){

        localStorage.setItem("user",JSON.stringify(data.user));

        window.location.href="dashboard.html";

    }

}