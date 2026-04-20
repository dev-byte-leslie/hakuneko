const DiscordRPC = require('discord-rpc');

const discordPresenceId = '726702836775256094';
DiscordRPC.register(discordPresenceId);

/**
 * HAKU-0032: Main-process Discord RPC client.
 * Renderer sends status via IPC; this class manages the discord-rpc connection.
 */
class DiscordPresenceMain {

    constructor() {
        this.rpc = null;
        this.IpcBytes = 0;
    }

    async start() {
        if (this.rpc) return;
        this.rpc = new DiscordRPC.Client({ transport: 'ipc' });
        try {
            await this.rpc.login({ clientId: discordPresenceId });
        } catch (error) {
            this.rpc = null;
            throw error;
        }
    }

    async stop() {
        if (this.rpc) {
            try {
                await this.rpc.clearActivity();
                this.rpc.destroy();
            } catch (_) { /* ignore cleanup errors */ }
            this.rpc = null;
        }
        this.IpcBytes = 0;
    }

    async setActivity(status) {
        if (!this.rpc) return { connected: false };
        try {
            const bytesBefore = this.rpc.transport.socket.bytesWritten;
            this.rpc.setActivity(status);
            // Give the socket time to flush (activity set is fire-and-forget)
            await new Promise(resolve => setTimeout(resolve, 500));
            const connected = this.rpc.transport.socket.bytesWritten > bytesBefore;
            this.IpcBytes = this.rpc.transport.socket.bytesWritten;
            return { connected };
        } catch (_) {
            return { connected: false };
        }
    }
}

module.exports = DiscordPresenceMain;
