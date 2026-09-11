# Connector Generator

App web para pineados de velocímetros / clusters 12V.

## Online (clientes)

1. Entra a [Firebase Console](https://console.firebase.google.com/) (gratis).
2. Crea un proyecto → **Authentication** → Sign-in method → habilita **Anónimo**.
3. **Firestore Database** → crear base (modo producción o prueba).
4. Project settings → Your apps → Web → copia el objeto `firebaseConfig`.
5. En la app: **Configuración** → pega el JSON → **Guardar y conectar nube**.
6. En Firestore → **Rules**, publica:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /conectores/{id} {
      allow read: if true;
      allow create, update: if request.auth != null
        && request.resource.data.keys().hasAll(['id','marca','modelo','pins'])
        && request.resource.data.marca is string
        && request.resource.data.modelo is string;
      allow delete: if request.auth != null
        && resource.data.uid == request.auth.uid;
    }
  }
}
```

Con eso, todos tus clientes ven y publican conectores en **Comunidad online**.

## Uso local

Abre `index.html` o https://jaciel15.github.io/conectores/

- Cámara o Galería para fotos
- Toca un pin → elige 12V / GND / CAN-H (se aplica al instante)
- Guarda → si la nube está activa, también se publica
