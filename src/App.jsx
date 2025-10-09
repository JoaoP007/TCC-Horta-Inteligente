// App.jsx ATUALIZADO com Modo Automático

import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import HistoryChart from './HistoryChart';
import { db } from './lib/firebase.js'; // Removi ensureAnonAuth, pois não é usado aqui
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

/** UI helpers */
const StatCard = ({ icon, title, value }) => (
  <div className="card">
    <div className="card-icon">{icon}</div>
    <div className="card-title">{title}</div>
    <div className="card-value">{value}</div>
  </div>
);

export default function App() {
  // Leituras de sensores
  const [soil, setSoil] = useState(13);
  const [temp, setTemp] = useState(24);

  // Status do atuador
  const [aspersorLigado, setAspersorLigado] = useState(false);

  // Agendamentos
  const [agenda, setAgenda] = useState([]);

  // --- NOVO: Estados para o Modo Automático ---
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [minHumidity, setMinHumidity] = useState(60); // Valor padrão de 60%

  // Inputs de agendamento
  const [hora, setHora] = useState("");
  const [duracao, setDuracao] = useState(1);

  /** --- Listeners Firestore --- */
  useEffect(() => {
    // Listener da Agenda
    const q = query(collection(db, "agendamentos"), orderBy("time", "asc"), orderBy("createdAt", "asc"));
    const unsubAgenda = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgenda(rows);
    });

    // Listener do Status do Aspersor
    const refStatus = doc(db, "status", "aspersor1");
    const unsubStatus = onSnapshot(refStatus, (snap) => {
      const data = snap.data();
      if (data && typeof data.isOn === "boolean") {
        setAspersorLigado(data.isOn);
      }
    });

    // --- NOVO: Listener para as Configurações do Modo Automático ---
    const refConfig = doc(db, "configuracao", "geral");
    const unsubConfig = onSnapshot(refConfig, (snap) => {
      const data = snap.data();
      if (data) {
        setIsAutoMode(data.autoModeEnabled === true); // Garante que seja booleano
        if (typeof data.minHumidity === 'number') {
            setMinHumidity(data.minHumidity);
        }
      }
    });

    return () => {
      unsubAgenda();
      unsubStatus();
      unsubConfig(); // Limpa o novo listener
    };
  }, []);


  /** --- Ações --- */
  const toggleAspersor = async () => {
    if (isAutoMode) return; // Não permite controle manual se o modo auto estiver ativo
    const desired = !aspersorLigado;
    setAspersorLigado(desired); // Atualização otimista
    await setDoc(
      doc(db, "comandos", "aspersor1"),
      { desired, updatedAt: serverTimestamp() },
      { merge: true }
    );
  };

  const addAgendamento = async () => {
    // ... (função addAgendamento continua a mesma)
    if (!hora) return alert("Escolha um horário (HH:MM).");
    const [HH, MM] = hora.split(":").map((s) => Number(s));
    if (Number.isNaN(HH) || Number.isNaN(MM)) return alert("Horário inválido.");
    
    const duracaoNumerica = Number(duracao);
    if (duracaoNumerica < 1) return alert("Duração mínima é 1 minuto.");

    await addDoc(collection(db, "agendamentos"), {
      time: `${String(HH).padStart(2, "0")}:${String(MM).padStart(2, "0")}`,
      minutes: duracaoNumerica,
      target: "aspersor1",
      enabled: true,
      createdAt: serverTimestamp(),
    });

    setHora("");
    setDuracao(1);
  };

  const removerAgendamento = async (id) => {
    await deleteDoc(doc(db, "agendamentos", id));
  };
  
  // --- NOVO: Função para atualizar as configurações do Modo Automático no Firebase ---
  const updateAutoModeConfig = async (newConfig) => {
    const configRef = doc(db, "configuracao", "geral");
    await setDoc(configRef, { ...newConfig, updatedAt: serverTimestamp() }, { merge: true });
  };
  
  const handleAutoModeToggle = () => {
    const novoEstado = !isAutoMode;
    setIsAutoMode(novoEstado);
    updateAutoModeConfig({ autoModeEnabled: novoEstado });
  };
  
  const handleHumidityChange = (e) => {
    const novoValor = Number(e.target.value);
    setMinHumidity(novoValor);
    updateAutoModeConfig({ minHumidity: novoValor });
  };


  /** --- UI helpers --- */
  const statusClasse = useMemo(
    () => (aspersorLigado ? "status ativo" : "status inativo"),
    [aspersorLigado]
  );
  const statusTexto = aspersorLigado ? "ATIVO" : "INATIVO";

  return (
    <div className="page">
      <main className="container">
        <header className="header">
          <span className="leaf">🌿</span>
          <h1>Painel da Horta Inteligente</h1>
        </header>

        <section className="stats">
          <StatCard icon={<span>💧</span>} title="Umidade do Solo" value={`${soil}%`} />
          <StatCard icon={<span>🌡️</span>} title="Temperatura" value={`${temp}°C`} />
        </section>

 {/* --- Painel de historico --- */}
        <section className="panel panel-full-width">
           <HistoryChart />
        </section>
        
        <section className="grid">
          {/* --- NOVO: Painel do Modo Automático --- */}
          <div className="panel">
            <h2>Modo Automático</h2>
            <div className="automode-control">
              <span>Status:</span>
              <button
                className={`btn ${isAutoMode ? 'btn-on' : 'btn-off'}`}
                onClick={handleAutoModeToggle}
              >
                {isAutoMode ? 'ATIVADO' : 'DESATIVADO'}
              </button>
            </div>
            <div className="automode-slider">
              <label>Umid. Mínima: <strong>{minHumidity}%</strong></label>
              <input
                type="range"
                min="0"
                max="100"
                value={minHumidity}
                onChange={handleHumidityChange}
                disabled={!isAutoMode} // Desabilita o slider se o modo auto estiver desligado
              />
            </div>
          </div>
        
          {/* Painel de Controle Manual */}
          <div className="panel">
            <h2>Controle Manual</h2>
            <div className="control-grid one">
              <div className="control-card">
                <div className="control-title">Aspersor 1</div>
                <div className={statusClasse}>{statusTexto}</div>
                <button
                  className={`btn ${aspersorLigado ? "btn-off" : "btn-on"}`}
                  onClick={toggleAspersor}
                  disabled={isAutoMode} // Desabilita o botão se o modo auto estiver ativo
                >
                  {aspersorLigado ? "Desligar" : "Ligar"}
                </button>
                {isAutoMode && <small className="disabled-text">Desativado no modo automático</small>}
              </div>
            </div>
          </div>
        </section>
        
        {/* O painel de agendamento foi movido para fora da grid para ocupar a largura toda */}
        <section className="panel panel-full-width">
            <h2>Agendamento de Irrigação</h2>
            {/* ... (código do agendamento continua o mesmo) ... */}
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
