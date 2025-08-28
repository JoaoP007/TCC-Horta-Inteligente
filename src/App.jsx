import React, { useEffect, useState, useCallback } from 'react'
import { db, ensureAnonAuth } from './lib/firebase'
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, deleteDoc, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { Cloud, Thermometer, Droplets, CircleSlash, Power, Leaf, Clock, Trash2, PlusCircle } from 'lucide-react'

const appId = import.meta.env.VITE_APP_ID || 'tcc-horta-inteligente'
const gardenDocPath = `artifacts/${appId}/public/data/garden/main`
const schedulesColPath = `${gardenDocPath}/schedules`

const getGardenRef = () => doc(db, gardenDocPath)
const getSchedulesRef = () => collection(db, schedulesColPath)

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [sensor, setSensor] = useState({ soilMoisture: 0, temperature: 0, humidity: 0 })
  const [valves, setValves] = useState({ valve1: false, valve2: false })
  const [schedules, setSchedules] = useState([])
  const [form, setForm] = useState({ time: '', valveId: 'valve1' })

  const ensureData = useCallback(async () => {
    const ref = getGardenRef()
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        sensors: { soilMoisture: 50, temperature: 22, humidity: 60 },
        valves: { valve1: false, valve2: false },
        lastUpdated: new Date().toISOString()
      })
    }
  }, [])

  useEffect(() => {
    (async () => {
      try {
        await ensureAnonAuth()
        await ensureData()

        const unsubGarden = onSnapshot(getGardenRef(), (snap) => {
          if (snap.exists()) {
            const d = snap.data()
            setSensor(d.sensors || { soilMoisture: 0, temperature: 0, humidity: 0 })
            setValves(d.valves || { valve1: false, valve2: false })
          }
          setReady(true)
        }, (e) => { console.error(e); setError('Erro ao buscar dados.'); setReady(true) })

        const qy = query(getSchedulesRef(), orderBy('time'))
        const unsubSched = onSnapshot(qy, (qs) => {
          const rows = []
          qs.forEach((d) => rows.push({ id: d.id, ...d.data() }))
          setSchedules(rows)
        })

        return () => { unsubGarden(); unsubSched() }
      } catch (e) {
        console.error('Falha init:', e)
        setError('Falha inicial Firebase.')
        setReady(true)
      }
    })()
  }, [ensureData])

  const toggleValve = async (valveId) => {
    try {
      await updateDoc(getGardenRef(), {
        [`valves.${valveId}`]: !valves[valveId],
        lastUpdated: new Date().toISOString()
      })
    } catch (e) { console.error(e); setError('Erro ao alternar válvula.') }
  }

  const updateMock = async () => {
    const next = {
      soilMoisture: Math.floor(Math.random() * 101),
      temperature: 15 + Math.floor(Math.random() * 16),
      humidity: 40 + Math.floor(Math.random() * 61)
    }
    try {
      await updateDoc(getGardenRef(), { sensors: next, lastUpdated: new Date().toISOString() })
    } catch (e) { console.error(e); setError('Erro ao atualizar mock.') }
  }

  const addSchedule = async (e) => {
    e.preventDefault()
    setError(null)

    console.log("DEBUG form.time:", form.time, "form.valveId:", form.valveId)

    if (!form.time) {
      setError('Por favor, selecione um horário válido.')
      return
    }

    try {
      await addDoc(getSchedulesRef(), {
        time: form.time,
        valveId: form.valveId,
        createdAt: serverTimestamp()
      })
      setForm({ time: '', valveId: 'valve1' })
    } catch (e) { 
      console.error("Erro ao adicionar:", e) 
      setError('Erro ao adicionar agendamento. Verifique permissões do Firestore.') 
    }
  }

  const delSchedule = async (id) => {
    try { await deleteDoc(doc(db, schedulesColPath, id)) }
    catch (e) { console.error(e); setError('Erro ao excluir agendamento.') }
  }

  if (!ready) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-14 w-14 border-t-4 border-green-500"></div></div>

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-gray-800 text-white">
      <header className="mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-green-400 flex items-center justify-center">
          <Leaf size={48} className="mr-3 text-green-500" /> Painel da Horta Inteligente
        </h1>
      </header>

      {error && <div className="bg-red-700 text-white px-4 py-3 rounded-lg mb-6">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card icon={<Droplets className="text-blue-400" />} title="Umidade do Solo" value={`${sensor.soilMoisture ?? 0}%`} />
        <Card icon={<Thermometer className="text-red-400" />} title="Temperatura" value={`${sensor.temperature ?? 0}°C`} />
        <Card icon={<Cloud className="text-sky-400" />} title="Umidade do Ar" value={`${sensor.humidity ?? 0}%`} />
      </div>

      <button onClick={updateMock} className="mb-8 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg">Atualizar Dados Mock</button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-gray-700 p-6 rounded-xl">
          <h2 className="text-2xl font-semibold mb-6 text-green-300">Controle Manual</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Valve valveId="valve1" label="Válvula 1" isOn={!!valves.valve1} onToggle={toggleValve} />
            <Valve valveId="valve2" label="Válvula 2" isOn={!!valves.valve2} onToggle={toggleValve} />
          </div>
        </section>

        <section className="bg-gray-700 p-6 rounded-xl">
          <h2 className="text-2xl font-semibold mb-6 text-green-300">Agendamento de Irrigação</h2>
          <form onSubmit={addSchedule} className="flex flex-col sm:flex-row gap-4 mb-6">
            <input 
              type="time" 
              required
              value={form.time}
              onChange={e => setForm({ ...form, time: e.target.value })}
              onBlur={e => setForm({ ...form, time: e.target.value })}
              className="bg-gray-600 text-white p-3 rounded-lg border-2 border-gray-500 flex-grow"
            />
            <select 
              value={form.valveId}
              onChange={e => setForm({ ...form, valveId: e.target.value })}
              className="bg-gray-600 text-white p-3 rounded-lg border-2 border-gray-500"
            >
              <option value="valve1">Válvula 1</option>
              <option value="valve2">Válvula 2</option>
            </select>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold p-3 rounded-lg flex items-center gap-2"><PlusCircle size={20} /> Adicionar</button>
          </form>

          <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
            {schedules.length ? schedules.map(s => (
              <div key={s.id} className="bg-gray-600 p-3 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-green-400" />
                  <span className="font-mono text-lg">{s.time}</span>
                  <span className="text-gray-300">{s.valveId === 'valve1' ? 'Válvula 1' : 'Válvula 2'}</span>
                </div>
                <button onClick={() => delSchedule(s.id)} className="text-red-400 hover:text-red-300"><Trash2 size={18} /></button>
              </div>
            )) : <p className="text-gray-400 text-center">Nenhum horário agendado.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

function Card({ icon, title, value }) {
  return <div className="bg-gray-700 p-5 rounded-xl flex flex-col items-center"><div className="text-4xl mb-3">{icon}</div><h3 className="text-lg font-semibold">{title}</h3><p className="text-3xl font-bold text-green-400">{value}</p></div>
}

function Valve({ valveId, label, isOn, onToggle }) {
  const Icon = isOn ? Power : CircleSlash
  const cls = isOn ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
  return <div className="bg-gray-600 p-6 rounded-lg flex flex-col items-center"><h4 className="text-xl mb-3">{label}</h4><p className={`mb-4 ${isOn ? 'text-green-400' : 'text-red-400'}`}>{isOn ? 'ATIVA' : 'INATIVA'}</p><button onClick={() => onToggle(valveId)} className={`w-full py-3 rounded-lg text-white ${cls} flex items-center justify-center`}><Icon size={18} className="mr-2" /> {isOn ? 'Desligar' : 'Ligar'}</button></div>
}
