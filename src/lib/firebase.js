// src/lib/firebase.js
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const raw = import.meta.env.VITE_FIREBASE_CONFIG || '{}'
console.log('RAW VITE_FIREBASE_CONFIG =', raw) // debug

let config = {}
try {
  config = JSON.parse(raw)
} catch (e) {
  console.error('VITE_FIREBASE_CONFIG não é JSON válido:', e)
}

const required = ['apiKey','authDomain','projectId','appId']
const ok = required.every(k => typeof config[k] === 'string' && config[k].length)
if (!ok) console.error('Config Firebase incompleto! Confira .env.local')

const app = getApps().length ? getApps()[0] : initializeApp(config)
export const auth = getAuth(app)
export const db = getFirestore(app)

export async function ensureAnonAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        await signInAnonymously(auth).catch((e) => console.error('Erro auth anon:', e))
      }
      resolve()
    })
  })
}
