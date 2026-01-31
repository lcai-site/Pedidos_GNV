# Script para reiniciar o servidor de desenvolvimento

Write-Host "Parando servidor..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

Write-Host "Iniciando servidor novamente..." -ForegroundColor Green
Set-Location "c:\Users\Camila N. B. Camacho\Documents\APP\Pedidos_GNV"
npm run dev
