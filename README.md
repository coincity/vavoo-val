Archivo            Descripción
Proxy v15          (ligero, streaming directo)
Proxy v21          (prefetch + pin + delay)




Idea general

Instalas Node en Termux (pkg install nodejs).
Copias el .js que quieras usar.
Arrancas: node v15.js (o v21).

En la TV usas: http://IP_DEL_MOVIL:3000/lista.

Móvil y TV en la misma WiFi. 
Con termux-wake-lock evitas que Android mate el proceso al apagar la pantalla.

Diferencia práctica:
v15: más ligera, ideal para el móvil.
v21: más estable en sesiones largas (prefetch), un poco más de RAM/CPU.

Solo uno a la vez (mismo puerto 3000).

más en manual-termux
