export default class InterProcessCommunication {

    constructor() {
        // Use the preload-exposed IPC bridge instead of require('electron').ipcRenderer
        this._ipc = window.hakunekoAPI.ipc;
    }

    listen(channel, handler) {
        this._ipc.on(channel, async (event, responseChannelID, payload) => {
            try {
                let data = await handler(payload);
                this._ipc.send(responseChannelID, data);
            } catch(error) {
                console.error(error);
                this._ipc.send(responseChannelID, undefined);
            }
        });
    }
}
