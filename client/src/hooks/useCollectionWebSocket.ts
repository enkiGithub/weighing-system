/**
 * WebSocket hook for real-time collection data
 * Connects to the backend WebSocket server and receives:
 * - group_weight_update: real-time cabinet group weight changes
 * - connection_status: device online/offline status changes
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface GroupWeightUpdate {
  type: 'group_weight_update';
  groupId: number;
  currentWeight: number;
  status: 'normal' | 'warning' | 'alarm';
  timestamp: number;
}

export interface ConnectionStatusUpdate {
  type: 'connection_status';
  comPortId: number;
  status: 'online' | 'offline';
  timestamp: number;
}

type WSMessage = GroupWeightUpdate | ConnectionStatusUpdate;

interface UseCollectionWebSocketOptions {
  onGroupWeightUpdate?: (update: GroupWeightUpdate) => void;
  onConnectionStatus?: (update: ConnectionStatusUpdate) => void;
  enabled?: boolean;
}

export function useCollectionWebSocket(options: UseCollectionWebSocketOptions) {
  const { onGroupWeightUpdate, onConnectionStatus, enabled = true } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  // Use refs for callbacks to avoid reconnecting when callbacks change
  const onGroupWeightUpdateRef = useRef(onGroupWeightUpdate);
  onGroupWeightUpdateRef.current = onGroupWeightUpdate;
  const onConnectionStatusRef = useRef(onConnectionStatus);
  onConnectionStatusRef.current = onConnectionStatus;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Build WebSocket URL from current page location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/collection`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] 前端WebSocket已连接');
        setConnected(true);
        // Clear any pending reconnect timer
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          if (msg.type === 'group_weight_update') {
            onGroupWeightUpdateRef.current?.(msg as GroupWeightUpdate);
          } else if (msg.type === 'connection_status') {
            onConnectionStatusRef.current?.(msg as ConnectionStatusUpdate);
          }
          // Ignore collection_data messages on the frontend (handled by backend)
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        // Error will be followed by close event
      };

      ws.onclose = () => {
        console.log('[WS] 前端WebSocket已断开，5秒后重连...');
        setConnected(false);
        wsRef.current = null;
        // Schedule reconnect
        if (enabled) {
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    } catch {
      // Schedule reconnect on connection failure
      if (enabled) {
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      // Cleanup on unmount
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [enabled, connect]);

  return { connected };
}
