# Guía paso a paso para publicar Memvia en Play Store

## 0. Antes de empezar (lo que necesitas)
- [ ] Cuenta de desarrollador de Google Play: 25 $ una sola vez, tarjeta de crédito/débito (no prepago), ser mayor de 18 años y verificar tu identidad. Si no eres mayor, que la abra un adulto.
- [ ] Un móvil Android para probar.
- [ ] **12 personas** que prueben la app **14 días seguidos** (obligatorio para cuentas personales nuevas antes de poder publicar).
- [ ] Ordenador con Node.js 18+ y Java (JDK 17).

## 1. Decidir el dominio (importante)
Memvia está en `alejandro22410.github.io/Memvia/`. Para que la app de Android abra sin barra de direcciones, Google comprueba un archivo en `https://alejandro22410.github.io/.well-known/assetlinks.json`. Ese archivo tiene que estar en la **raíz del dominio**, y GitHub solo lo permite si creas un repositorio llamado exactamente `alejandro22410.github.io` con una carpeta `.well-known` dentro.
- Opción A (recomendada): crea ese repositorio (con un archivo vacío `.nojekyll`) y sube ahí `.well-known/assetlinks.json`.
- Opción B: comprar un dominio propio (≈10 €/año) y apuntarlo a GitHub Pages.
- Opción C: publicar sin verificar. Funciona, pero la app muestra una barra de direcciones arriba.

## 2. Crear el paquete .aab
Con Bubblewrap (la herramienta oficial de Google):
```
npm i -g @bubblewrap/cli
mkdir memvia-android && cd memvia-android
bubblewrap init --manifest=https://alejandro22410.github.io/Memvia/manifest.webmanifest
bubblewrap build
```
(En `store/twa-manifest.json` tienes los valores ya preparados: `packageId` = `io.github.alejandro22410.memvia`. El nombre del paquete **no se puede cambiar nunca**.)
Te pedirá crear un archivo `.keystore` y una contraseña. **Guárdalos en 2 sitios.** Si los pierdes, no podrás actualizar la app.
Alternativa sin comandos: https://www.pwabuilder.com (pega la URL de Memvia y descarga el paquete Android).

## 3. Huella SHA-256 → assetlinks
1. En Play Console, sube el `.aab` (paso 5). Después ve a **Configuración → Integridad de la app → Firma de apps** y copia la huella **SHA-256 del certificado de firma de la app**.
2. Pégala en `store/assetlinks.plantilla.json` y súbelo como `.well-known/assetlinks.json` (paso 1).
3. Comprueba que `https://alejandro22410.github.io/.well-known/assetlinks.json` abre en el navegador.

## 4. Preparar la ficha
Todo lo que necesitas está en esta carpeta: textos (`FICHA.md`), iconos y capturas, permisos (`PERMISOS.md`), datos (`DATOS-SEGURIDAD.md`) y acceso para revisores (`REVISORES.md`).

## 5. Subir a pruebas cerradas
1. Play Console → **Crear aplicación** (idioma: español, tipo: app, gratis).
2. Completa los formularios del panel: política de privacidad, acceso a la app, anuncios (no), clasificación de contenido, público objetivo (adultos), seguridad de los datos, app de salud.
3. **Pruebas → Pruebas cerradas → Crear versión**, sube el `.aab`, añade a tus 12 probadores (por correo de Google).
4. Los probadores aceptan la invitación e instalan. Tienen que mantenerla **14 días**.

## 6. Pedir acceso a producción
Pasados los 14 días, Play Console te deja **solicitar acceso a producción**. Google tarda unos días en revisar. Al aprobarse, creas la versión de producción con el mismo `.aab`.

## 7. Cada vez que actualices
1. Sube `VERSION_APP` en `js/app.js` y anota los cambios en `CHANGELOG.md`.
2. Los cambios de la web se ven solos en la app, pero si cambias iconos o nombre, sube un `.aab` nuevo con `appVersion` +1.

## Qué no he podido comprobar desde aquí
- No he podido generar el `.aab` ni probarlo en un Android real.
- No he podido comprobar los formularios reales de Play Console: pueden haber cambiado. Si una pregunta no coincide, pídeme ayuda con una captura.
- Las normas de Google para apps de salud cambian: lee el aviso que muestre Play Console.
