let socket
const wsUrl = 'ws://localhost:4000' // WebSocket server URL
const reconnectInterval = 1000 // Reconnect every 1 second

export const connectWebSocket = () => {
    socket = new WebSocket(wsUrl)

    try {
		socket = new WebSocket(wsUrl);
	} catch (error) {
		// Handle or ignore the error here
		console.log('WebSocket initialization error:', error.message);
	}

    socket.onmessage = event => {
        if (event.data === 'reload') {
            window.location.reload()
        }
    }

    socket.onclose = () => {
        console.log('WebSocket connection lost, attempting to reconnect...')
        setTimeout(connectWebSocket, reconnectInterval) //x Reconnect after 1 second
    }
}

