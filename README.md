# Vavoo Proxy en Termux (móvil) → TV / TVBox en red local

Guía para correr **v15** o **v21** en el móvil con Termux y consumir los streams desde la TV o TVBox usando la IP del móvil.

Archivos listos:
- `v15.js` — versión ligera (streaming directo de segmentos)
- `v21.js` — versión con prefetch, pin y delay automático

Solo se usa **uno u otro** a la vez (mismo puerto 3000).

---

## 1. Requisitos

- Móvil Android con **Termux** (recomendado desde F-Droid, no Play Store)
- Móvil y TV/TVBox en la **misma WiFi**
- Datos o WiFi en el móvil (el proxy descarga los streams de internet)

---

## 2. Instalación de Termux y Node

Abre Termux y ejecuta:

```bash
pkg update -y
pkg install -y nodejs
```

Comprueba:

```bash
node -v
# debe mostrar v18 o superior (ideal v20+)
```

Opcional pero recomendable (evita que Android duerma el proceso):

```bash
pkg install -y termux-api
```

En Android: **Ajustes → Apps → Termux → Batería → Sin restricciones**.

---

## 3. Copiar los scripts

```bash
mkdir -p ~/vavoo
cd ~/vavoo
```

Copia ahí:

- `v15.js`
- `v21.js`

Formas fáciles de pasarlos al móvil:

1. Pegar con el editor de Termux:
   ```bash
   nano v15.js
   # pega el contenido → Ctrl+O → Enter → Ctrl+X
   ```
2. Desde almacenamiento interno:
   ```bash
   termux-setup-storage
   cp /sdcard/Download/v15.js ~/vavoo/
   cp /sdcard/Download/v21.js ~/vavoo/
   ```
3. Git / SCP desde el PC

**No hace falta** `npm install`: son JavaScript puro con Node (módulos nativos).

---

## 4. Arrancar el proxy

### Solo uno a la vez

**Versión v15** (más ligera, streaming directo):

```bash
cd ~/vavoo
node v15.js
```

**Versión v21** (prefetch + pin + delay):

```bash
cd ~/vavoo
node v21.js
```

Deberías ver:

```text
Vavoo Proxy v15 listo en el puerto 3000
```

### Evitar que el móvil duerma el proceso

```bash
termux-wake-lock
node v15.js
```

Al terminar:

```bash
# Ctrl+C para parar el proxy
termux-wake-unlock
```

Con `tmux` (queda en segundo plano):

```bash
pkg install -y tmux
tmux
cd ~/vavoo && termux-wake-lock && node v15-termux.js
# Ctrl+B, luego D  → desconectar
# tmux attach       → volver
```

---

## 5. Saber la IP del móvil

```bash
ip -4 addr show wlan0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'
```

O:

```bash
ifconfig wlan0
```

Ejemplo: `192.168.1.45`

---

## 6. Usar desde la TV / TVBox

### Lista M3U (recomendado)

En TiviMate, IPTV Smarters, VLC, etc.:

```
http://192.168.1.45:3000/lista
```

Sustituye por la IP real de tu móvil.

### Canal suelto

```
http://192.168.1.45:3000/live?ch=historia.b
http://192.168.1.45:3000/live?ch=liga.b
http://192.168.1.45:3000/live?ch=daznliga
```

### Otros endpoints

| URL | Qué hace |
|-----|----------|
| `/lista` | Lista M3U |
| `/channels` | JSON canales locales + Spain |
| `/find?ch=historia.b` | Buscar canal |
| `/debug?ch=historia.b` | Diagnóstico |
| `/live?ch=...` | Manifest HLS |

---

## 7. v15 vs v21

| | **v15** | **v21** |
|---|---------|---------|
| Estilo | Segmentos en streaming directo | Prefetch + cache de segmentos + pin 6h |
| RAM / CPU en el móvil | Más ligera | Un poco más pesada |
| Ideal para | Móvil con poca RAM, uso ocasional | Uso más largo, menos cortes |

No corras las dos a la vez: usan el mismo puerto.

---

## 8. Problemas frecuentes

**La TV no conecta**
- Misma WiFi (no solo datos del móvil)
- Redes “invitado” a veces aíslan dispositivos
- Prueba en el móvil: `http://127.0.0.1:3000/lista`

**“unavailable” o canal no encontrado**
- Abre `/debug?ch=historia.b` y mira el mensaje
- Prueba `/find?ch=historia`

**Se corta al bloquear el móvil**
- `termux-wake-lock`
- Batería → Termux → Sin restricciones
- `tmux` o Termux en primer plano

**Puerto ocupado**
```bash
pkill -f "node v1"
# o otro puerto:
PORT=3001 node v15-termux.js
```

---

## 9. Flujo típico

1. Móvil en WiFi de casa  
2. Termux → `cd ~/vavoo && termux-wake-lock && node v15.js`  
3. Anotas la IP (`192.168.x.x`)  
4. En la TV: lista `http://192.168.x.x:3000/lista`  
5. Al terminar: Ctrl+C y `termux-wake-unlock`

---

## 10. Notas

- El móvil hace de **puente**: descarga de internet y sirve en LAN.
- Consume batería y datos del móvil; conviene WiFi + cargador.
- No expongas el puerto a internet (solo red local).
- Los nombres de canal aceptan variantes (`historia.b`, `HISTORIA.B`, etc.).

## TAMBIEN SE PUEDE INSTALAR CON CLONE MÁS FACILMENTE
