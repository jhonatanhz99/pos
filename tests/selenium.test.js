const express = require('express');
const path = require('path');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// 1. Iniciar servidor mock del backend (Puerto 3000)
const backendApp = express();
backendApp.use(express.json());
backendApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

backendApp.post('/api/login', (req, res) => {
  const { usuario, contrasena } = req.body;
  console.log(`[Mock Backend] Petición de login recibida para usuario: ${usuario}`);
  res.json({
    success: true,
    message: 'Login exitoso.',
    token: 'mock-token-selenium-12345',
    usuario: {
      id: 1,
      nombre: 'Admin Test',
      correo: usuario,
      rol: 'admin'
    }
  });
});

const backendServer = backendApp.listen(3000, () => {
  console.log('[Mock Backend] Corriendo en http://localhost:3000');
});
backendServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n*** ERROR: El puerto 3000 ya está siendo usado por tu backend real. Apágalo antes de correr esta prueba localmente. ***\n');
    process.exit(1);
  }
});

// 2. Iniciar servidor del frontend (Puerto 3001) para servir la compilación de producción
const frontendApp = express();
const buildPath = path.join(__dirname, '../frontend/build');
frontendApp.use(express.static(buildPath));
frontendApp.get('/*any', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const frontendServer = frontendApp.listen(3001, () => {
  console.log('[Mock Frontend] Corriendo en http://localhost:3001');
});
frontendServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n*** ERROR: El puerto 3001 ya está siendo usado. ***\n');
    process.exit(1);
  }
});

// 3. Ejecutar la prueba funcional con Selenium
async function runTest() {
  console.log('Iniciando prueba de Selenium...');
  
  // Configurar Chrome en modo headless (sin interfaz gráfica) para CI
  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    // Abrir la página del frontend
    console.log('Navegando a http://localhost:3001...');
    await driver.get('http://localhost:3001');

    // Esperar a que los elementos del login carguen
    console.log('Esperando formulario de login...');
    await driver.wait(until.elementLocated(By.css('input[type="email"]')), 10000);

    // Llenar campos de login
    const emailInput = await driver.findElement(By.css('input[type="email"]'));
    const passwordInput = await driver.findElement(By.css('input[type="password"]'));
    const submitButton = await driver.findElement(By.css('button[type="submit"]'));

    console.log('Escribiendo credenciales...');
    await emailInput.sendKeys('admin@test.com');
    await passwordInput.sendKeys('contrasenna123');

    console.log('Haciendo clic en "Entrar"...');
    await submitButton.click();

    // Esperar a la redirección a /dashboard
    console.log('Esperando redirección al Dashboard...');
    await driver.wait(until.urlContains('/dashboard'), 10000);

    const currentUrl = await driver.getCurrentUrl();
    console.log(`URL actual: ${currentUrl}`);

    if (currentUrl.includes('/dashboard')) {
      console.log('¡PRUEBA DE SELENIUM COMPLETADA CON ÉXITO! Login redirigido correctamente.');
    } else {
      throw new Error(`Fallo de redirección. URL actual: ${currentUrl}`);
    }
  } catch (error) {
    console.error('¡La prueba de Selenium ha fallado!', error);
    try {
      const screenshot = await driver.takeScreenshot();
      const fs = require('fs');
      fs.writeFileSync(path.join(__dirname, 'failure.png'), screenshot, 'base64');
      console.log('Captura de pantalla guardada en tests/failure.png');
    } catch (err) {
      console.error('No se pudo guardar la captura de pantalla:', err);
    }
    process.exitCode = 1;
  } finally {
    // Cerrar navegador y apagar servidores
    console.log('Limpiando y cerrando procesos...');
    await driver.quit();
    backendServer.close();
    frontendServer.close();
    console.log('Servidores detenidos.');
  }
}

runTest();
