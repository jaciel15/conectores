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

if(bar)
{
bar.style.width = percent + “%”;
}

if(i < mensajes.length)
{
if(status)
{
status.innerHTML = mensajes[i];
}
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


/* FOTO */

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


/* PINOUT */

function generarPinout()
{
let filas = parseInt(
prompt("¿Cuántas filas tiene el conector?")
);

if(isNaN(filas) || filas<=0)
{
alert("Número de filas inválido");
return;
}

let pines = parseInt(
prompt("¿Cuántos pines tiene el conector?")
);

if(isNaN(pines) || pines<=0)
{
alert("Número de pines inválido");
return;
}

let columnas = Math.ceil(pines / filas);

document.getElementById("pinout").style.gridTemplateColumns =
"repeat(" + columnas + ",1fr)";

let html = "";

for(let i=1;i<=pines;i++)
{
html +=
'<div class="pin" onclick="editarPin(this,'+i+')">'+i+'</div>';
}

document.getElementById("pinout").innerHTML = html;
}


function editarPin(pin,numero)
{
let opcion = prompt(
'PIN '+numero+'\n\n'+
'1 = 12V\n'+
'2 = GND\n'+
'3 = RPM\n'+
'4 = VELOCIDAD'
);

if(opcion=="1")
{
pin.style.background="#ff0000";
pin.style.color="#ffffff";
}

if(opcion=="2")
{
pin.style.background="#000000";
pin.style.color="#ffffff";
pin.style.border="2px solid #00ffff";
}

if(opcion=="3")
{
pin.style.background="#8000ff";
pin.style.color="#ffffff";
}

if(opcion=="4")
{
pin.style.background="#8B4513";
pin.style.color="#ffffff";
}
}
/* NUEVO CONECTOR */

function abrirNuevoConector()
{
let ventana =
document.getElementById("nuevoConector");

if(ventana.style.display==“block”)
{
ventana.style.display=“none”;
}
else
{
ventana.style.display=“block”;
}
}

function guardarConector()
{
let tipo =
document.getElementById(“tipo”).value;

let marca =
document.getElementById(“marca”).value;

let modelo =
document.getElementById(“modelo”).value;

let version =
document.getElementById(“version”).value;

if(tipo==””)
{
alert(“Seleccione tipo”);
return;
}

if(marca==””)
{
alert(“Ingrese marca”);
return;
}

if(modelo==””)
{
alert(“Ingrese modelo”);
return;
}

let datos = {
tipo: tipo,
marca: marca,
modelo: modelo,
version: version
};

localStorage.setItem(
“ultimoConector”,
JSON.stringify(datos)
);

alert(“Conector guardado correctamente”);
}

function siguientePaso()
{
alert(“Próximo paso: Editor Visual de Pines”);
}