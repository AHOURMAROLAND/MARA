import { useState, useEffect, useCallback, useRef } from 'react';

export default function useWebSocket(url, onMessage) {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  const savedOnMessage = useRef(onMessage);

  // Remember the latest callback if it changes.
  useEffect(() => {
    savedOnMessage.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url) return;
    
    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WS Connected to', url);
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (savedOnMessage.current) savedOnMessage.current(data);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.current.onclose = () => {
        console.log('WS Disconnected from', url);
        setIsConnected(false);
        // Basic reconnection logic
        setTimeout(connect, 3000);
      };

      ws.current.onerror = (err) => {
        console.error('WS Error:', err);
        ws.current.close();
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.onclose = null; // Prevent reconnect on unmount
        ws.current.close();
      }
    };
  }, [url]);

  const sendMessage = useCallback((msg) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    } else {
      console.warn('WS not connected. Message not sent:', msg);
    }
  }, []);

  return { isConnected, sendMessage };
}
