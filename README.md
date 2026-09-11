# Mi Horario

Aplicación web para gestionar tu horario de clases: día, salón, materia y horas de inicio/fin. Funciona correctamente en computador y en celular.

## Estructura del proyecto

```
horario-app/
├── index.html          # Estructura de la página
├── README.md           # Este archivo
├── style.css            # Estilos (tema oscuro, acento rojo, animaciones)
├── app.js               # Lógica de la aplicación
└── favicon.svg          # Ícono de la pestaña del navegador
```

Descarga la carpeta `horario-app` completa y mantén sus archivos en la raíz: `index.html` referencia `style.css`, `app.js` y `favicon.svg` por ruta relativa.

## 100% local, sin conexión a internet

La versión anterior cargaba las tipografías desde Google Fonts, lo que rompía el requisito de correr todo en local. Se quitó esa dependencia: ahora la app usa únicamente fuentes ya instaladas en el sistema operativo (`system-ui`, `Segoe UI`, `Roboto`, `Helvetica Neue`, `Arial`), diferenciando títulos y texto por peso y espaciado en vez de por tipografía. El resultado visual es muy similar al anterior y la app abre y se ve igual con o sin internet.

Los íconos de la interfaz (lápiz, papelera, reloj, etc.) siguen definidos como un sprite SVG dentro de `index.html` en lugar de un archivo aparte en `images/`: al abrir el proyecto con doble clic (protocolo `file://`), algunos navegadores bloquean la carga de `<use>` hacia un `.svg` externo, así que dejarlos inline garantiza que siempre se vean.

## Cómo usarla

Abre `index.html` en tu navegador (doble clic o "Abrir con..."). No necesita instalación, servidor ni internet.

## Arquitectura del código (`app.js`)

- **`ScheduleEntry`** — modelo de una clase individual (día, materia, salón, hora inicio, hora fin).
- **`ScheduleStore`** — repositorio en memoria: agregar, actualizar, eliminar y consultar clases por día.
- **`ScheduleApp`** — controlador de la interfaz: dibuja el tablero, maneja el formulario, el reloj en vivo, el buscador y las notificaciones (toasts).

## Funcionalidades

- Todas las columnas de días visibles siempre (sin necesidad de hacer clic); el día de hoy se reordena automáticamente al inicio y se resalta.
- Banner en vivo que indica si tienes una clase en curso ahora mismo, según la hora real.
- Reloj y horas de clase siempre en **formato de 24 horas** (formato militar), tanto en el reloj del encabezado como en las tarjetas.
- Selector de hora amigable: en vez del control nativo del navegador (inconsistente entre sistemas y a veces en formato 12h), el formulario usa dos listas desplegables — hora (00–23) y minutos (pasos de 5) — que garantizan el formato 24h en cualquier equipo.
- Buscador para filtrar clases por materia o salón.
- Crear, editar y eliminar clases, con animaciones y notificaciones.
- Exportar el horario a un archivo `.json` e importarlo después.

## Persistencia de datos

La app guarda el horario **en memoria durante la sesión** (no usa almacenamiento del navegador). Para conservar tus datos entre sesiones, usa el botón **Exportar** antes de cerrar la página y **Importar** la próxima vez que la abras.
