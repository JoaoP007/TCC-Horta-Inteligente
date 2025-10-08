import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { db } from "./firebase";
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
  // Leituras de sensores (caso leia do Firestore, conecte aqui)
  const [soil, setSoil] = useState(13);
  const [temp, setTemp] = useState(24);

  // Status do atuador (lido do Firestore em /status/aspersor1)
  const [aspersorLigado, setAspersorLigado] = useState(false);

  // Agendamentos (coleção /agendamentos)
  const [agenda, setAgenda] = useState([]);

  // Inputs
  const [hora, setHora] = useState(""); // "HH:MM"
  const [duracao, setDuracao] = useState(1);

  /** --- Listeners Firestore --- */
  useEffect(() => {
    // Agenda em tempo real (ordena por time, depois por createdAt)
    const q = query(
      collection(db, "agendamentos"),
      orderBy("time", "asc"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgenda(rows);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Status do aspersor 1 em tempo real
    const ref = doc(db, "status", "aspersor1");
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (data && typeof data.isOn === "boolean") {
        setAspersorLigado(data.isOn);
      }
    });
    return () => unsub();
  }, []);

  /** --- Ações --- */
  const toggleAspersor = async () => {
    const desired = !aspersorLigado;
    // escrita do comando (otimista)
    setAspersorLigado(desired);
    await setDoc(
      doc(db, "comandos", "aspersor1"),
      { desired, updatedAt: serverTimestamp() },
      { merge: true }
    );
    // ESP32 deve observar /comandos/aspersor1.desired e, ao aplicar,
    // atualizar /status/aspersor1.isOn com o estado real.
  };

  const addAgendamento = async () => {
    if (!hora) return alert("Escolha um horário (HH:MM).");
    const [HH, MM] = hora.split(":").map((s) => Number(s));
    if (Number.isNaN(HH) || Number.isNaN(MM)) return alert("Horário inválido.");
    if (duracao < 1) return alert("Duração mínima é 1 minuto.");

    await addDoc(collection(db, "agendamentos"), {
      time: `${String(HH).padStart(2, "0")}:${String(MM).padStart(2, "0")}`,
      minutes: duracao,
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

        {/* Sem Umidade do Ar */}
        <section className="stats">
          <StatCard icon={<span>💧</span>} title="Umidade do Solo" value={`${soil}%`} />
          <StatCard icon={<span>🌡️</span>} title="Temperatura" value={`${temp}°C`} />
        </section>

        <section className="grid">
          {/* Controle Manual */}
          <div className="panel">
            <h2>Controle Manual</h2>
            <div className="control-grid one">
              <div className="control-card">
                <div className="control-title">Arpersor 1</div>
                <div className={statusClasse}>{statusTexto}</div>
                <button
                  className={`btn ${aspersorLigado ? "btn-off" : "btn-on"}`}
                  onClick={toggleAspersor}
                >
                  {aspersorLigado ? "Desligar" : "Ligar"}
                </button>
              </div>
            </div>
          </div>

          {/* Agendamento (com duração min >= 1) */}
          <div className="panel">
            <h2>Agendamento de Irrigação</h2>

            <div className="agendar">
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="time-input"
              />

              {/* alvo fixo — apenas 1 aspersor, mantendo layout */}
              <select className="select" disabled value="aspersor1" onChange={() => {}}>
                <option value="aspersor1">Arpersor 1</option>
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
                      {it.time} • {it.minutes} min • Arpersor 1 {it.enabled === false ? "• (desativado)" : ""}
                    </span>
                    <button className="btn small danger" onClick={() => removerAgendamento(it.id)}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
