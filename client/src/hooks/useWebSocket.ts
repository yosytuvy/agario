import { useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

export const useWebSocket = (url: string) => {
    const ws = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(
        null
    );
    // Fix: Add initial value (null) for the timeout ref
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);

    const connect = useCallback(() => {
        try {
            ws.current = new WebSocket(url);

            ws.current.onopen = () => {
                console.log("WebSocket Connected");
                setIsConnected(true);
                reconnectAttempts.current = 0;
            };

            ws.current.onclose = () => {
                console.log("WebSocket Disconnected");
                setIsConnected(false);

                // Attempt to reconnect
                if (reconnectAttempts.current < 5) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        console.log(
                            `Reconnecting... Attempt ${reconnectAttempts.current}`
                        );
                        connect();
                    }, 1000 * reconnectAttempts.current);
                }
            };

            ws.current.onerror = (error) => {
                console.error("WebSocket Error:", error);
            };

            ws.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    setLastMessage(message);
                    console.log("Received:", message);
                } catch (e) {
                    console.error("Failed to parse message:", e);
                }
            };
        } catch (error) {
            console.error("Failed to create WebSocket:", error);
        }
    }, [url]);

    const sendMessage = useCallback((message: WebSocketMessage) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message));
        } else {
            console.warn("WebSocket is not connected");
        }
    }, []);

    useEffect(() => {
        // Small delay to ensure component is mounted
        const connectTimeout = setTimeout(() => {
            connect();
        }, 100);

        return () => {
            clearTimeout(connectTimeout);
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [connect]);

    return {
        sendMessage,
        lastMessage,
        isConnected,
    };
};
