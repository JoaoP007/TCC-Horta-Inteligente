import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
// Passo 1: Importamos a função de autenticação
import { db, ensureAnonAuth } from './lib/firebase.js'; 
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import HistoryChart from './HistoryChart';

const StatCard = ({ icon, title, value }) => (
  <div className="card">
    <div className="card-icon">{icon}</div>
    <div className="card-title">{title}</div>
    <div className="card-value">{value}</div>
  </div>
);

export default function App() {
  const [soil, setSoil] = useState(13);
  const [temp, setTemp] = useState(24);
  const [aspersorLigado, setAspersorLigado] = useState(false);
  const [agenda, setAgenda] = useState([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [minHumidity, setMinHumidity] = useState(35);
  const [hora, setHora] = useState("");
  const [duracao, setDuracao] = useState(1);

  // Passo 2: O useEffect foi reestruturado
  useEffect(() => {
    // Esta função será chamada após a autenticação
    const setupListeners = () => {
      // Listener da Agenda
      const q = query(collection(db, "agendamentos"), orderBy("time", "asc"), orderBy("createdAt", "asc"));
      const unsubAgenda = onSnapshot(q, (snap) => setAgenda(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

      // Listener do Status do Aspersor
      const refStatus = doc(db, "status", "aspersor1");
      const unsubStatus = onSnapshot(refStatus, (snap) => {
        const data = snap.data();
        if (data && typeof data.isOn === "boolean") setAspersorLigado(data.isOn);
      });

      // Listener para as Configurações do Modo Automático
      const refConfig = doc(db, "configuracao", "geral");
      const unsubConfig = onSnapshot(refConfig, (snap) => {
        const data = snap.data();
        if (data) {
          setIsAutoMode(data.autoModeEnabled === true);
          if (typeof data.minHumidity === 'number') setMinHumidity(data.minHumidity);
        }
      });

      // Retorna uma função de limpeza para todos os listeners
      return () => {
        unsubAgenda();
        unsubStatus();
        unsubConfig();
      };
    };

    // Primeiro, garante a autenticação anônima
    ensureAnonAuth().then(() => {
      // Após autenticar com sucesso, configura os listeners de dados
      const cleanupListeners = setupListeners();
      // A função de limpeza do useEffect cuidará de remover os listeners
      return cleanupListeners;
    });

  }, []); // O array vazio garante que isso rode apenas uma vez

  // ... (todo o resto do seu código continua exatamente igual) ...
  const toggleAspersor = async () => { /* ... */ };
  const addAgendamento = async () => { /* ... */ };
  const removerAgendamento = async (id) => { /* ... */ };
  const updateAutoModeConfig = async (newConfig) => { /* ... */ };
  const handleAutoModeToggle = () => { /* ... */ };
  const handleHumidityChange = (e) => { /* ... */ };
  const statusClasse = useMemo(() => (aspersorLigado ? "status ativo" : "status inativo"), [aspersorLigado]);
  const statusTexto = aspersorLigado ? "ATIVO" : "INATIVO";

  return (
    <div className="page">
        {/* ... (toda a sua estrutura JSX continua exatamente igual) ... */}
        <main className="container">
          <header className="header">
            <span className="leaf">🌿</span>
            <h1>Painel da Horta Inteligente</h1>
          </header>
          <section className="stats">
            <StatCard icon={<span>💧</span>} title="Umidade do Solo" value={`${soil}%`} />
            <StatCard icon={<span>🌡️</span>} title="Temperatura" value={`${temp}°C`} />
          </section>
          <section className="panel">
            <HistoryChart />
          </section>
          <section className="grid">
            <div className="panel">
              <h2>Modo Automático</h2>
              <div className="automode-control">
                <span>Status:</span>
                <button className={`btn ${isAutoMode ? 'btn-on' : 'btn-off'}`} onClick={handleAutoModeToggle}>
                  {isAutoMode ? 'ATIVADO' : 'DESATIVADO'}
                </button>
              </div>
              <div className="automode-slider">
                <label>Umid. Mínima: <strong>{minHumidity}%</strong></label>
                <input type="range" min="0" max="100" value={minHumidity} onChange={handleHumidityChange} disabled={!isAutoMode} />
              </div>
            </div>
            <div className="panel">
              <h2>Controle Manual</h2>
              <div className="control-grid one">
                <div className="control-card">
                  <div className="control-title">Aspersor 1</div>
                  <div className={statusClasse}>{statusTexto}</div>
                  <button className={`btn ${aspersorLigado ? "btn-off" : "btn-on"}`} onClick={toggleAspersor} disabled={isAutoMode}>
                    {aspersorLigado ? "Desligar" : "Ligar"}
                  </button>
                  {isAutoMode && <small className="disabled-text">Desativado no modo automático</small>}
                </div>
              </div>
            </div>
          </section>
          <section className="panel">
              <h2>Agendamento de Irrigação</h2>
              <div className="agendar">
                   <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="time-input"/>
                   <select className="select" disabled value="aspersor1"> <option value="aspersor1">Aspersor 1</option> </select>
                   <div className="duracao-wrap">
                     <label>Duração (min)</label>
                     <input type="number" min={1} value={duracao} onChange={(e) => setDuracao(Math.max(1, Number(e.target.value)))} className="number-input" />
                   </div>
                   <button className="btn add" onClick={addAgendamento}> ＋ Adicionar </button>
              </div>
              {agenda.length === 0 ? (<p className="lista-vazia">Nenhum horário agendado.</p>) : (
                  <ul className="lista">
                      {agenda.map((it) => (
                      <li key={it.id} className="item">
                          <span className="when">{it.time} • {it.minutes} min • Aspersor 1</span>
                          <button className="btn small danger" onClick={() => removerAgendamento(it.id)}>Remover</button>
                      </li>
                      ))}
                  </ul>
              )}
          </section>
        </main>
    </div>
  );
}
