import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { db, ensureAnonAuth } from "./lib/firebase.js";
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
import HistoryChart from "./HistoryChart";

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

  useEffect(() => {
    const setupListeners = () => {
      const q = query(
        collection(db, "agendamentos"),
        orderBy("time", "asc"),
        orderBy("createdAt", "asc")
      );
      const unsubAgenda = onSnapshot(q, (snap) =>
        setAgenda(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      );

      const refStatus = doc(db, "status", "aspersor1");
      const unsubStatus = onSnapshot(refStatus, (snap) => {
        const data = snap.data();
        if (data && typeof data.isOn === "boolean") setAspersorLigado(data.isOn);
      });

      const refConfig = doc(db, "configuracao", "geral");
      const unsubConfig = onSnapshot(refConfig, (snap) => {
        const data = snap.data();
        if (data) {
          setIsAutoMode(data.autoModeEnabled === true);
          if (typeof data.minHumidity === "number") setMinHumidity(data.minHumidity);
        }
      });

      return () => {
        unsubAgenda();
        unsubStatus();
        unsubConfig();
      };
    };

    ensureAnonAuth().then(() => {
      const cleanup = setupListeners();
      return cleanup;
    });
  }, []);

  const toggleAspersor = async () => {
    if (isAutoMode) return;
    try {
      await ensureAnonAuth();
      const refStatus = doc(db, "status", "aspersor1");
      await setDoc(
        refStatus,
        { isOn: !aspersorLigado, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Erro ao alternar aspersor:", err);
      alert("Não foi possível alternar o aspersor.");
    }
  };

  const addAgendamento = async () => {
    try {
      if (!hora || !/^\d{2}:\d{2}$/.test(hora)) {
        alert("Informe um horário válido (HH:MM).");
        return;
      }
      if (Number(duracao) < 1) {
        alert("A duração mínima é 1 minuto.");
        return;
      }
      await ensureAnonAuth();
      await addDoc(collection(db, "agendamentos"), {
        time: hora,
        minutes: Number(duracao),
        aspersorId: "aspersor1",
        createdAt: serverTimestamp(),
      });
      setHora("");
    } catch (err) {
      console.error("Erro ao adicionar agendamento:", err);
      alert("Não foi possível adicionar o agendamento.");
    }
  };

  const removerAgendamento = async (id) => {
    try {
      await ensureAnonAuth();
      await deleteDoc(doc(db, "agendamentos", id));
    } catch (err) {
      console.error("Erro ao remover agendamento:", err);
      alert("Não foi possível remover o agendamento.");
    }
  };

  const updateAutoModeConfig = async (newConfig) => {
    try {
      await ensureAnonAuth();
      await setDoc(
        doc(db, "configuracao", "geral"),
        { ...newConfig, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Erro ao atualizar configuração:", err);
      alert("Não foi possível salvar a configuração.");
    }
  };

  const handleAutoModeToggle = () => {
    const next = !isAutoMode;
    setIsAutoMode(next);
    updateAutoModeConfig({ autoModeEnabled: next });
  };

  const handleHumidityChange = (e) => {
    const v = Number(e.target.value);
    setMinHumidity(v);
    if (isAutoMode) updateAutoModeConfig({ minHumidity: v });
  };

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

        {/* 1) Cards no topo */}
        <section className="stats">
          <StatCard icon={<span>💧</span>} title="Umidade do Solo" value={`${soil}%`} />
          <StatCard icon={<span>🌡️</span>} title="Temperatura" value={`${temp}°C`} />
        </section>

        {/* 2) Controles logo abaixo */}
        <section className="grid">
          <div className="panel">
            <h2>Modo Automático</h2>
            <div className="automode-control">
              <span>Status:</span>
              <button
                className={`btn ${isAutoMode ? "btn-on" : "btn-off"}`}
                onClick={handleAutoModeToggle}
              >
                {isAutoMode ? "ATIVADO" : "DESATIVADO"}
              </button>
            </div>
            <div className="automode-slider">
              <label>
                Umid. Mínima: <strong>{minHumidity}%</strong>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={minHumidity}
                onChange={handleHumidityChange}
                disabled={!isAutoMode}
              />
            </div>
          </div>

          <div className="panel">
            <h2>Controle Manual</h2>
            <div className="control-grid one">
              <div className="control-card">
                <div className="control-title">Aspersor 1</div>
                <div className={statusClasse}>{statusTexto}</div>
                <button
                  className={`btn ${aspersorLigado ? "btn-off" : "btn-on"}`}
                  onClick={toggleAspersor}
                  disabled={isAutoMode}
                >
                  {aspersorLigado ? "Desligar" : "Ligar"}
                </button>
                {isAutoMode && (
                  <small className="disabled-text">Desativado no modo automático</small>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3) Agendamento */}
        <section className="panel">
          <h2>Agendamento de Irrigação</h2>
          <div className="agendar">
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="time-input"
            />
            <select className="select" disabled value="aspersor1">
              <option value="aspersor1">Aspersor 1</option>
            </select>
            <div className="duracao-wrap">
              <label>Duração (min)</label>
              <input
                type="number"
                min={1}
                value={duracao}
                onChange={(e) => setDuracao(Math.max(1, Number(e.target.value)))}
                className="number-input"
              />
            </div>
            <button className="btn add" onClick={addAgendamento}>
              ＋ Adicionar
            </button>
          </div>

          {agenda.length === 0 ? (
            <p className="lista-vazia">Nenhum horário agendado.</p>
          ) : (
            <ul className="lista">
              {agenda.map((it) => (
                <li key={it.id} className="item">
                  <span className="when">
                    {it.time} • {it.minutes} min • Aspersor 1
                  </span>
                  <button
                    className="btn small danger"
                    onClick={() => removerAgendamento(it.id)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4) Gráfico por último */}
        <section className="panel">
          <h2>Histórico das Últimas 24 Horas</h2>
          <div className="chart-container">
            <HistoryChart />
          </div>
        </section>
      </main>
    </div>
  );
}
