let socket
const wsUrl = 'ws://localhost:4000' // WebSocket server URL
const reconnectInterval = 3000 // Reconnect every 3 second

export const connectWebSocket = () => {
    socket = new WebSocket(wsUrl)
	socket = new WebSocket(wsUrl);

    socket.onmessage = event => {
        if (event.data === 'reload') {
            window.location.reload()
        }
    }

    socket.onclose = () => {
        setTimeout(connectWebSocket, reconnectInterval) //Reconnect after 1 second
    }
}

