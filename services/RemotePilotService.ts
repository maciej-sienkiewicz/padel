import { Platform } from 'react-native';

class RemotePilotService {
    private pilotID: string = '';
    private serverIP: string = '';
    private connected: boolean = false;

    constructor() {
        this.pilotID = this.generatePilotID();
    }

    // Generuj unikalny pilot ID (symulacja ESP32 chip ID)
    private generatePilotID(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `PHONE-${timestamp}${random}`.toUpperCase();
    }

    getPilotID(): string {
        return this.pilotID;
    }

    // Połącz się z serwerem kamery
    async connectToServer(serverIP: string): Promise<boolean> {
        console.log(`Connecting to server: ${serverIP}`);

        this.serverIP = serverIP;

        try {
            // Wyślij rejestrację
            const response = await fetch(`http://${serverIP}:8080/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pilotID: this.pilotID,
                    type: 'register',
                    deviceType: 'phone', // Oznacz że to telefon, nie ESP32
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Registration response:', data);
                this.connected = true;
                return true;
            } else {
                console.error('Registration failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Connection error:', error);
            return false;
        }
    }

    // Wyślij sygnał capture
    async sendCapture(minutes: number): Promise<boolean> {
        if (!this.connected || !this.serverIP) {
            console.error('Not connected to server');
            return false;
        }

        console.log(`Sending capture signal: ${minutes} minutes`);

        try {
            const response = await fetch(`http://${this.serverIP}:8080/capture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pilotID: this.pilotID,
                    type: 'capture',
                    duration: minutes * 60, // Konwertuj na sekundy
                    timestamp: Date.now(),
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Capture response:', data);
                return true;
            } else {
                console.error('Capture failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Capture error:', error);
            return false;
        }
    }

    // Rozłącz
    disconnect() {
        this.connected = false;
        this.serverIP = '';
        console.log('Disconnected from server');
    }

    // Status połączenia
    isConnected(): boolean {
        return this.connected;
    }

    getServerIP(): string {
        return this.serverIP;
    }
}

export default new RemotePilotService();