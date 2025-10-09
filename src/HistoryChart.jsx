import React, { useState, useEffect } from 'react';
import { db } from './lib/firebase.js';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Registra os componentes necessários do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function HistoryChart() {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });

  useEffect(() => {
    // Busca os últimos 48 registros (24 horas, se 1 registro a cada 30 min)
    const q = query(
      collection(db, 'historico'),
      orderBy('timestamp', 'desc'),
      limit(48)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        console.log('Nenhum dado histórico encontrado.');
        return;
      }

      // Os dados vêm em ordem decrescente, então invertemos para o gráfico
      const historicalData = snapshot.docs.reverse().map((doc) => doc.data());

      setChartData({
        labels: historicalData.map((data) =>
          // Formata o timestamp para uma hora legível (ex: "14:30")
          new Date(data.timestamp?.toDate()).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        ),
        datasets: [
          {
            label: 'Umidade do Solo (%)',
            data: historicalData.map((data) => data.soilMoisture),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            yAxisID: 'y',
            fill: true,
          },
          {
            label: 'Temperatura (°C)',
            data: historicalData.map((data) => data.temperature),
            borderColor: '#e57373',
            backgroundColor: 'rgba(229, 115, 115, 0.2)',
            yAxisID: 'y1',
          },
        ],
      });
    });

    return () => unsubscribe();
  }, []);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Histórico das Últimas 24 Horas' },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Umidade (%)' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Temperatura (°C)' },
        grid: { drawOnChartArea: false }, // Evita linhas de grade duplicadas
      },
    },
  };

  return (
    <div className="chart-container">
      <Line data={chartData} options={options} />
    </div>
  );
}
