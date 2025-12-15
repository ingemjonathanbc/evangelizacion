@echo off
setlocal

echo [INFO] Iniciando EvangelioAuto Studio...

:: 1. Verificar dependencias de Python
echo [1/3] Verificando e instalando dependencias de Python...
pip install -r backend/requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Falló la instalación de dependencias. Revisa tu instalación de Python.
    pause
    exit /b %errorlevel%
)

:: 2. Iniciar Backend (Flask)
echo [2/3] Iniciando Servidor Backend (Puerto 5000)...
start "EvangelioAuto Backend" cmd /k "cd backend && python app.py"

:: 3. Iniciar Frontend (Vite)
echo [3/3] Iniciando Frontend React...
start "EvangelioAuto Frontend" cmd /k "npm run dev"

echo.
echo [EXITO] Todo iniciado correctamente.
echo - El Backend corre en: http://localhost:5000
echo - El Frontend abrirá tu navegador pronto.
echo.
echo No cierres las ventanas de consola negra.
pause
