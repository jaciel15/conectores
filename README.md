# Connector Generator

App web para velocímetros digitales **12V** (CDMX).

## Qué hace
- Escanear o subir foto del conector
- Detectar filas/pines con **Gemini IA** (API key opcional)
- Generar y colorear pinout (BATT, GND, RPM, SPEED, etc.)
- Guardar por jerarquía: **Motocicletas/Autos → Marca → Modelo → Versión** (ej. Yamaha XSR V1 y V2)
- Editar conectores guardados
- Tema **claro / oscuro**
- Navegación atrás / cerrar en catálogo Yamaha

## Uso
1. Abre `index.html` en el navegador (o sirve la carpeta con cualquier servidor estático)
2. En **Configuración**, pega tu Gemini API Key (gratis en Google AI Studio) para detección automática
3. Sin API key puedes indicar filas/pines a mano y guardar igual

## Archivos
- `index.html` / `script.js` / `style.css` — app principal
- `database.html` — acceso rápido a la base de datos
- `motos/yamaha/` — catálogo de modelos
- `catalog.css` — estilos del catálogo
