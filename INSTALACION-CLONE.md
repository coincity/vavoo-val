# Instalación rápida con Git clone (Termux)

Repo: https://github.com/coincity/vavoo-val

## 1. Instalar Termux + Node + Git

```bash
pkg update -y
pkg install -y nodejs git
```

Opcional (evitar que Android mate el proceso):

```bash
pkg install -y termux-api
# En Android: Ajustes → Apps → Termux → Batería → Sin restricciones
```

## 2. Clonar el repo

```bash
cd ~
git clone https://github.com/coincity/vavoo-val.git
cd vavoo-val
```

## 3. Arrancar (elige una versión)

**v15** (más ligera):

```bash
termux-wake-lock
node v15.js
```

**v21** (prefetch + pin + delay):

```bash
termux-wake-lock
node v21.js
```

Verás algo como:

```text
Vavoo Proxy v15 listo en el puerto 3000
```

## 4. IP del móvil

```bash
ip -4 addr show wlan0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'
```

Ejemplo: `192.168.1.45`

## 5. En la TV / TVBox

Lista M3U:

```
http://192.168.1.45:3000/lista
```

Canal suelto:

```
http://192.168.1.45:3000/live?ch=historia.b
```

## 6. Actualizar más adelante

```bash
cd ~/vavoo-val
git pull
```

## 7. Parar

- `Ctrl+C` en Termux
- `termux-wake-unlock`

---

### Resumen de un vistazo

```bash
pkg update -y && pkg install -y nodejs git termux-api
cd ~ && git clone https://github.com/coincity/vavoo-val.git
cd vavoo-val
termux-wake-lock
node v15.js
# IP → http://IP:3000/lista en la TV
```

Móvil y TV en la **misma WiFi**. Solo una versión a la vez (mismo puerto 3000).
