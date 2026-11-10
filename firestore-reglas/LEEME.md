# Reglas de Firestore por etapas

Las reglas publicadas ahora son las simples (cada persona solo toca su documento). Estas etapas añaden más comprobaciones **de una en una**, para saber cuál falla si algo falla.

Cómo probar cada etapa (5 minutos):
1. Firebase → Firestore Database → pestaña **Reglas**.
2. Borra todo, pega el contenido de `etapaN.rules` y pulsa **Publicar**. Espera 1 minuto.
3. Abre Memvia con `?diag` al final de la web, entra en Ajustes y pulsa «Probar la conexión». Deben salir dos ✅.
4. Añade un familiar, recarga la página y comprueba que sigue ahí.
5. Si sale ✅ → pasa a la siguiente etapa. Si sale un fallo → **vuelve a pegar las reglas simples** (abajo) y dime en qué etapa fue y qué mensaje salió.

Reglas simples (las de seguridad mínima, siempre sirven de vuelta atrás):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /memvia_users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
