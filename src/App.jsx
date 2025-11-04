rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    // --- AGENDAMENTOS ---
    match /agendamentos/{docId} {
      allow read, delete: if isSignedIn();

      // ... dentro de match /agendamentos/{docId}
allow create: if isSignedIn()
  && request.resource.data.keys().hasAll(['time','minutes','aspersorId','createdAt','days'])
  && request.resource.data.time is string
  && request.resource.data.minutes is number
  && request.resource.data.minutes >= 1
  && request.resource.data.aspersorId == 'aspersor1'
  && request.resource.data.days is list
  && request.resource.data.days.size() >= 1
  && request.resource.data.days.size() <= 7;

    
    // --- STATUS (controle manual) ---
    match /status/aspersor1 {
      allow read: if isSignedIn();
      allow write: if isSignedIn()
        && request.resource.data.keys().hasAll(['isOn','updatedAt'])
        && request.resource.data.isOn is bool;
    }

    // --- CONFIGURAÇÃO (modo automático) ---
    match /configuracao/geral {
      allow read: if isSignedIn();

      // permite atualizar qualquer um desses campos, com tipos corretos
      allow write: if isSignedIn()
        && request.resource.data.keys().hasAny(['autoModeEnabled','minHumidity','maxHumidity','updatedAt'])
        && (!('autoModeEnabled' in request.resource.data) || request.resource.data.autoModeEnabled is bool)
        && (!('minHumidity' in request.resource.data) || request.resource.data.minHumidity is number)
        && (!('maxHumidity' in request.resource.data) || request.resource.data.maxHumidity is number);
    }

    // --- HISTÓRICO (gráfico) ---
    match /historico/{docId} {
      allow read: if isSignedIn();
      allow write: if false; // somente ESP32 escreve (via backend/firmware)
    }

    // bloqueia o resto
    match /{document=**} {
      allow read, write: if false;
    }
  }
}}
