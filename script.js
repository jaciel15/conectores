let bar = document.getElementById("loading-bar");

let status = document.getElementById("status");

let menu = document.getElementById("menu");

let splash = document.getElementById("splash");

let percent = 0;

let mensajes = [
"Cargando módulos...",
"Preparando escáner...",
"Inicializando Pinout Engine...",
"Conectando Base de Datos...",
"Sistema listo..."
];

let i = 0;

let timer = setInterval(function(){

percent += 5;

bar.style.width = percent + "%";

if(i < mensajes.length)
{
status.innerHTML = mensajes[i];
i++;
}

if(percent >= 100)
{
clearInterval(timer);

setTimeout(function(){

splash.style.display="none";

menu.style.display="block";

},1000);
}

},200);
function mostrarFoto(event)
{
  const archivo = event.target.files[0];

  if(!archivo) return;

  const lector = new FileReader();

  lector.onload = function(e)
  {
    document.getElementById("preview").src = e.target.result;
  };

  lector.readAsDataURL(archivo);
}