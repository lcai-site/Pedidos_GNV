@echo off
:: ================================================================
:: SYNC DATABASES - Executado pelo Agendador de Tarefas do Windows
:: Sincroniza dados: Produção → Desenvolvimento (a cada 1 hora)
:: ================================================================

:: Definir diretório do projeto
cd /d "c:\Users\Camila N. B. Camacho\Documents\APP\Pedidos_GNV"

:: Log com timestamp
echo ================================================== >> scripts\sync.log
echo [%date% %time%] Iniciando sincronizacao... >> scripts\sync.log

:: Executar script de sync
npx tsx scripts/sync-databases.ts >> scripts\sync.log 2>&1

echo [%date% %time%] Sync finalizado (exit code: %errorlevel%) >> scripts\sync.log
echo ================================================== >> scripts\sync.log
