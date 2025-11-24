# 🌱 Horta Inteligente - Sistema de Irrigação via IoT - João Silva

> Este projeto é parte do Trabalho de Conclusão de Curso (TCC) em Manufatura Avançada na FATEC Sorocaba.

O **Horta Inteligente** é um sistema de monitoramento e automação agrícola desenvolvido para reduzir o desperdício de água e facilitar o manejo de pequenas plantações. O sistema utiliza a Internet das Coisas (IoT) para medir a umidade do solo em tempo real e controlar a irrigação remotamente através de uma interface web.

## 📸 Funcionalidades

O dashboard desenvolvido permite:

- **Monitoramento em Tempo Real:** Visualização da porcentagem de umidade do solo.
- **Controle Manual:** Acionamento remoto da válvula solenoide/aspersor.
- **Modo Automático:** Definição de "gatilhos" (umidade mínima e máxima) para irrigação autônoma.
- **Agendamento:** Programação de horários e dias da semana para irrigação.
- **Histórico:** Gráficos com dados de umidade dos últimos 15 dias.


## 🛠️ Tecnologias Utilizadas

### Software & Interface
- **[React.js](https://react.dev/):** Biblioteca JavaScript para construção da interface de usuário.
- **[Vite](https://vitejs.dev/):** Ferramenta de build rápida para o front-end.
- **[Node.js](https://nodejs.org/):** Ambiente de execução para o back-end e broker MQTT.
- **[MQTT](https://mqtt.org/):** Protocolo de comunicação leve entre o site e o hardware.
- **[Firebase](https://firebase.google.com/):** Banco de dados em nuvem para histórico e autenticação.

### Hardware (IoT)
- **Microcontrolador:** ESP32 (Programado via Arduino IDE).
- **Sensores:** Sensor de Umidade de Solo Capacitivo.
- **Atuadores:** Válvula Solenoide 12V e Módulo Relé.
- **Estrutura:** Cases impressas em 3D (ABS).

## 🚀 Como Rodar o Projeto

### Pré-requisitos
Antes de começar, você precisará ter instalado em sua máquina:
- [Node.js](https://nodejs.org/en/)
- [Git](https://git-scm.com/)

### Instalação
Clone o repositório:
   ```bash
   git clone [https://github.com/SEU-USUARIO/NOME-DO-REPO.git](https://github.com/SEU-USUARIO/NOME-DO-REPO.git)
