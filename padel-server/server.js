const WebSocket = require('ws');
const os = require('os');

// Utwórz serwer WebSocket na porcie 8080
const wss = new WebSocket.Server({ port: 8080 });

// Przechowuj połączone urządzenia
const cameras = new Map();  // Kamery
const remotes = new Map();  // Piloty

console.log('🚀 Padel Server uruchomiony!');
console.log('');

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    console.log(`✅ Nowe połączenie z: ${clientIP}`);

    // Obsługa wiadomości od klienta
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Otrzymano: ${message.type} od ${message.role || 'unknown'}`);

            // REJESTRACJA URZĄDZENIA
            if (message.type === 'register') {
                if (message.role === 'camera') {
                    cameras.set(ws, { ip: clientIP, connectedAt: new Date() });
                    console.log(`📹 Kamera zarejestrowana. Łącznie kamer: ${cameras.size}`);

                    // Powiadom kamerę ile pilotów jest połączonych
                    ws.send(JSON.stringify({
                        type: 'status',
                        message: `Połączonych pilotów: ${remotes.size}`
                    }));

                    // Powiadom piloty że kamera się połączyła
                    remotes.forEach((info, remote) => {
                        if (remote.readyState === WebSocket.OPEN) {
                            remote.send(JSON.stringify({
                                type: 'register',
                                role: 'camera',
                                message: 'Kamera połączona!'
                            }));
                        }
                    });

                } else if (message.role === 'remote') {
                    remotes.set(ws, { ip: clientIP, connectedAt: new Date() });
                    console.log(`🎮 Pilot zarejestrowany. Łącznie pilotów: ${remotes.size}`);

                    // Powiadom pilot ile kamer jest połączonych
                    ws.send(JSON.stringify({
                        type: 'status',
                        message: `Połączonych kamer: ${cameras.size}`
                    }));

                    // Powiadom kamery że pilot się połączył
                    cameras.forEach((info, camera) => {
                        if (camera.readyState === WebSocket.OPEN) {
                            camera.send(JSON.stringify({
                                type: 'register',
                                role: 'remote',
                                message: 'Pilot połączony!'
                            }));
                        }
                    });
                }
            }

            // SYGNAŁ NAGRYWANIA
            else if (message.type === 'capture') {
                console.log('🎬 CAPTURE! Przekazuję do kamer...');

                let sentCount = 0;
                cameras.forEach((info, camera) => {
                    if (camera.readyState === WebSocket.OPEN) {
                        camera.send(JSON.stringify(message));
                        sentCount++;
                    }
                });

                console.log(`✅ Przekazano do ${sentCount} kamer`);

                // Potwierdź pilotowi
                ws.send(JSON.stringify({
                    type: 'status',
                    message: `Sygnał wysłany do ${sentCount} kamer`
                }));
            }

            // PING-PONG (keep-alive)
            else if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }

        } catch (error) {
            console.error('❌ Błąd parsowania wiadomości:', error);
        }
    });

    // Obsługa rozłączenia
    ws.on('close', () => {
        cameras.delete(ws);
        remotes.delete(ws);
        console.log(`👋 Klient rozłączony. Kamery: ${cameras.size}, Piloty: ${remotes.size}`);
    });

    // Obsługa błędów
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

// Funkcja do wyświetlenia lokalnego IP
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Pomiń adresy wewnętrzne i IPv6
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();
console.log('📱 Połącz telefony z tym adresem:');
console.log(`   ws://${localIP}:8080`);
console.log('');
console.log('💡 Upewnij się że telefony i komputer są w tej samej sieci WiFi');
console.log('');
console.log('📊 Status:');
console.log(`   Kamery: 0`);
console.log(`   Piloty: 0`);
console.log('');

// Co 30 sekund wyświetl status
setInterval(() => {
    console.log(`📊 Status: Kamery: ${cameras.size}, Piloty: ${remotes.size}`);
}, 30000);