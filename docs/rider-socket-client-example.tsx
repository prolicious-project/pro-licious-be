/**
 * Example: Socket.IO client hook for Rider Dashboard
 * 
 * This example shows how to:
 * 1. Extract token from localStorage
 * 2. Connect to Socket.IO with token in auth handshake
 * 3. Listen to pending assignments
 * 4. Listen to new rider assignments
 * 
 * Usage in your Rider Dashboard component:
 * 
 *   const { socket, pendingAssignments, isOnline } = useRiderSocket(userId, token);
 *   
 *   return (
 *     <>
 *       <h2>Orders {isOnline ? '✓ Online' : '✗ Offline'}</h2>
 *       {pendingAssignments.map(a => (
 *         <OrderCard key={a.id} assignment={a} />
 *       ))}
 *     </>
 *   );
 */

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface RiderAssignment {
  id: number;
  orderId: number;
  riderId: number;
  status: string;
  assignedAt: string;
  acceptedAt?: string;
  completedAt?: string;
}

export function useRiderSocket(userId: number, token?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<RiderAssignment[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Get token from localStorage if not passed
    const authToken = token || localStorage.getItem('accessToken');
    if (!authToken) {
      console.warn('No token found; socket auth will fail');
      return;
    }

    // Connect with token in auth handshake
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: { token: authToken },
      transports: ['websocket', 'polling'], // fallback to polling if websocket fails
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // On successful connection
    newSocket.on('connect', () => {
      console.log('✓ Socket connected:', newSocket.id);
    });

    // Receive pending assignments when connecting
    newSocket.on('pending_assignments', (data: { assignments: RiderAssignment[] }) => {
      console.log('Pending assignments:', data.assignments);
      setPendingAssignments(data.assignments);
    });

    // Receive notification of new assignment
    newSocket.on('rider_assigned', (data: any) => {
      console.log('New assignment:', data);
      // Optionally re-fetch or add to list
      setPendingAssignments((prev) => [
        ...prev,
        { id: data.orderId, orderId: data.orderId, riderId: data.riderId, status: 'ASSIGNED', assignedAt: new Date().toISOString() },
      ]);
    });

    // Order status changes
    newSocket.on('order_status_changed', (data: any) => {
      console.log('Order status changed:', data);
    });

    // Connection errors
    newSocket.on('connect_error', (error: any) => {
      console.error('Socket connection error:', error);
    });

    // Disconnection
    newSocket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
      setIsOnline(false);
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [token]);

  // Helper: mark rider as online
  const goOnline = async (riderId: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit('rider_go_online', { riderId });
    setIsOnline(true);
  };

  // Helper: mark rider as offline
  const goOffline = async (riderId: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit('rider_go_offline', { riderId });
    setIsOnline(false);
  };

  // Helper: send location update
  const sendLocation = async (orderId: number, riderId: number, latitude: number, longitude: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit('rider_location_update', { orderId, riderId, latitude, longitude });
  };

  // Helper: join an order room for live updates
  const joinOrderRoom = (orderId: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit('join_order_room', { orderId, userId, role: 'RIDER' });
  };

  return {
    socket,
    pendingAssignments,
    isOnline,
    goOnline,
    goOffline,
    sendLocation,
    joinOrderRoom,
  };
}

/**
 * Simple usage example component
 */
export function RiderDashboardExample() {
  const userId = 1; // from auth context
  const [riderId, setRiderId] = useState<number | null>(null);
  const { pendingAssignments, isOnline, goOnline, goOffline } = useRiderSocket(userId);

  useEffect(() => {
    // Fetch rider ID on mount
    const fetchRider = async () => {
      const res = await fetch('http://localhost:5000/api/rider/profile', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      const data = await res.json();
      setRiderId(data?.data?.id || null);
    };
    fetchRider();
  }, []);

  return (
    <div>
      <div style={{ padding: '1rem', background: isOnline ? '#90EE90' : '#FFB6C6' }}>
        <h2>Rider Status: {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}</h2>
        {riderId && (
          <button onClick={() => (isOnline ? goOffline(riderId) : goOnline(riderId))}>
            Go {isOnline ? 'Offline' : 'Online'}
          </button>
        )}
      </div>
      <div style={{ padding: '1rem' }}>
        <h3>Pending Assignments ({pendingAssignments.length})</h3>
        {pendingAssignments.length === 0 ? (
          <p>Looking for orders...</p>
        ) : (
          <ul>
            {pendingAssignments.map((a) => (
              <li key={a.id}>
                Order {a.orderId} — Status: {a.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
