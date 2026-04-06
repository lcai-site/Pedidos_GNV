@echo off
REM ================================================================
REM CONSOLIDAR PEDIDOS - Script para Windows Task Scheduler
REM ================================================================
REM 
REM Como agendar:
REM   1. Abra o Agendador de Tarefas do Windows (taskschd.msc)
REM   2. Criar Tarefa Basica > Nome: "Consolidar Pedidos GNV"
REM   3. Disparador: Diario, a cada 1 hora (ou conforme necessidade)
REM   4. Acao: Iniciar Programa > Este arquivo .bat
REM   5. Diretorio inicial: caminho do projeto
REM
REM ================================================================

cd /d "%~dp0\.."
echo [%date% %time%] Executando consolidacao...
npx tsx scripts/consolidar-pedidos.ts
echo [%date% %time%] Concluido (exit code: %errorlevel%)
