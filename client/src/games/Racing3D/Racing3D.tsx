import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Box, Plane, PerspectiveCamera, Text, Sky, Cloud, Trail } from '@react-three/drei';
import * as THREE from 'three';
import './Racing3D.css';

interface Racing3DProps {
  game: any;
  socket: any;
  room: any;
  player: any;
  playerId: string;
}

// Oyuncu renkleri (8 oyuncu için)
const PLAYER_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#E91E63',
  '#9C27B0', '#00BCD4', '#FFEB3B', '#795548'
];

// Şerit pozisyonları (4 şerit)
const LANE_POSITIONS = [-2.25, -0.75, 0.75, 2.25];
const TRACK_WIDTH = 6;
const TRACK_LENGTH = 500;

// Interpolated car component for smooth movement
function InterpolatedCar({ 
  targetPosition, 
  color, 
  isPlayer, 
  playerName, 
  carIndex,
  nitroActive,
  crashed
}: any) {
  const meshRef = useRef<THREE.Group>(null);
  const currentPos = useRef(targetPosition);
  const velocity = useRef([0, 0, 0]);
  
  useFrame((state, delta) => {
    if (meshRef.current && targetPosition) {
      // Much smoother interpolation
      const lerpFactor = 0.15; // Smoother interpolation for all cars
      
      // Calculate velocity for prediction
      velocity.current[0] = (targetPosition[0] - currentPos.current[0]) / delta;
      velocity.current[2] = (targetPosition[2] - currentPos.current[2]) / delta;
      
      // Interpolate position with dead zone to prevent jitter
      const deltaX = targetPosition[0] - currentPos.current[0];
      const deltaZ = targetPosition[2] - currentPos.current[2];
      
      if (Math.abs(deltaX) > 0.001) {
        currentPos.current[0] = THREE.MathUtils.lerp(
          currentPos.current[0], 
          targetPosition[0], 
          lerpFactor
        );
      } else {
        currentPos.current[0] = targetPosition[0];
      }
      
      currentPos.current[1] = targetPosition[1];
      
      if (Math.abs(deltaZ) > 0.001) {
        currentPos.current[2] = THREE.MathUtils.lerp(
          currentPos.current[2], 
          targetPosition[2], 
          lerpFactor
        );
      } else {
        currentPos.current[2] = targetPosition[2];
      }
      
      meshRef.current.position.set(...currentPos.current);
      
      // Car animations
      if (!crashed) {
        // Tilt based on lane change velocity
        meshRef.current.rotation.z = -velocity.current[0] * 0.05;
        
        // Bobbing effect
        meshRef.current.position.y += Math.sin(state.clock.elapsedTime * 10 + carIndex) * 0.01;
        
        // Rotation based on speed
        if (isPlayer) {
          meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.02;
        }
      } else {
        // Crash spin
        meshRef.current.rotation.y += 0.2;
        meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 5) * 0.3;
      }
    }
  });

  return (
    <group ref={meshRef}>
      {/* Trail effect for nitro */}
      {nitroActive && (
        <Trail
          width={1}
          length={10}
          color={new THREE.Color(color)}
          attenuation={(t) => t * t}
        >
          <mesh>
            <boxGeometry args={[0.6, 0.4, 1.2]} />
            <meshStandardMaterial color={color} transparent opacity={0} />
          </mesh>
        </Trail>
      )}
      
      {/* Car body */}
      <Box args={[0.6, 0.4, 1.2]} castShadow receiveShadow>
        <meshStandardMaterial 
          color={color} 
          metalness={0.6} 
          roughness={0.4}
          emissive={nitroActive ? color : '#000000'}
          emissiveIntensity={nitroActive ? 0.3 : 0}
        />
      </Box>
      
      {/* Cabin */}
      <Box args={[0.5, 0.3, 0.6]} position={[0, 0.3, 0.1]} castShadow>
        <meshStandardMaterial 
          color={color} 
          metalness={0.8} 
          roughness={0.2}
        />
      </Box>
      
      {/* Wheels with rotation */}
      {[[-0.3, -0.2, 0.4], [0.3, -0.2, 0.4], [-0.3, -0.2, -0.4], [0.3, -0.2, -0.4]].map((pos, i) => (
        <Box key={i} args={[0.15, 0.15, 0.1]} position={pos as [number, number, number]} castShadow>
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </Box>
      ))}
      
      {/* Player name */}
      {playerName && (
        <Text
          position={[0, 1, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          {playerName}
        </Text>
      )}
      
      {/* Headlights */}
      {isPlayer && !crashed && (
        <>
          <pointLight position={[0.2, 0, 0.6]} intensity={0.5} color="yellow" distance={5} />
          <pointLight position={[-0.2, 0, 0.6]} intensity={0.5} color="yellow" distance={5} />
          <spotLight
            position={[0, 0.2, 0.5]}
            angle={0.5}
            penumbra={0.5}
            intensity={nitroActive ? 2 : 1}
            color={nitroActive ? '#00ffff' : 'yellow'}
            target-position={[0, 0, -10]}
          />
        </>
      )}
    </group>
  );
}

function SmoothCameraController({ carPosition, carLane, cameraMode }: any) {
  const { camera } = useThree();
  const smoothPosition = useRef({ x: 0, y: 6, z: 10 });
  const lookAtTarget = useRef({ x: 0, y: 0, z: 0 });
  
  useFrame((state, delta) => {
    if (carPosition !== undefined && carLane !== undefined) {
      const targetX = LANE_POSITIONS[carLane] || 0;
      
      let targetPos = { x: 0, y: 6, z: 10 };
      let lookAt = { x: 0, y: 0, z: 0 };
      
      if (cameraMode === 'follow') {
        // Dynamic follow camera
        targetPos = {
          x: targetX,
          y: 6 + Math.sin(state.clock.elapsedTime * 0.5) * 0.5,
          z: -carPosition + 12
        };
        lookAt = { x: targetX, y: 0, z: -carPosition - 5 };
      } else if (cameraMode === 'top') {
        // Top down view
        targetPos = {
          x: 0,
          y: 25,
          z: -carPosition + 5
        };
        lookAt = { x: 0, y: 0, z: -carPosition };
      } else if (cameraMode === 'first-person') {
        // First person view
        targetPos = {
          x: targetX,
          y: 1.5,
          z: -carPosition - 1
        };
        lookAt = { x: targetX, y: 1, z: -carPosition - 10 };
      }
      
      // Smooth camera movement with better damping
      const lerpFactor = 0.1;
      smoothPosition.current.x = THREE.MathUtils.lerp(smoothPosition.current.x, targetPos.x, lerpFactor);
      smoothPosition.current.y = THREE.MathUtils.lerp(smoothPosition.current.y, targetPos.y, lerpFactor);
      smoothPosition.current.z = THREE.MathUtils.lerp(smoothPosition.current.z, targetPos.z, lerpFactor);
      
      lookAtTarget.current.x = THREE.MathUtils.lerp(lookAtTarget.current.x, lookAt.x, lerpFactor);
      lookAtTarget.current.y = THREE.MathUtils.lerp(lookAtTarget.current.y, lookAt.y, lerpFactor);
      lookAtTarget.current.z = THREE.MathUtils.lerp(lookAtTarget.current.z, lookAt.z, lerpFactor);
      
      camera.position.set(
        smoothPosition.current.x,
        smoothPosition.current.y,
        smoothPosition.current.z
      );
      
      camera.lookAt(
        lookAtTarget.current.x,
        lookAtTarget.current.y,
        lookAtTarget.current.z
      );
    }
  });
  
  return null;
}

function DynamicTrack({ obstacles, trackPosition, powerUps }: any) {
  const trackRef = useRef<THREE.Group>(null);
  const [visibleSegments, setVisibleSegments] = useState<number[]>([]);
  
  useEffect(() => {
    // Calculate visible track segments
    const segmentSize = 50;
    const currentSegment = Math.floor(trackPosition / segmentSize);
    const segments = [];
    
    for (let i = -2; i <= 5; i++) {
      segments.push(currentSegment + i);
    }
    
    setVisibleSegments(segments);
  }, [Math.floor(trackPosition / 50)]);
  
  useFrame(() => {
    if (trackRef.current) {
      // Infinite scrolling effect
      trackRef.current.position.z = (trackPosition % 50) * 0.1;
    }
  });
  
  return (
    <group ref={trackRef}>
      {/* Render only visible track segments */}
      {visibleSegments.map((segmentIndex) => {
        const segmentZ = -segmentIndex * 50;
        
        return (
          <group key={segmentIndex} position={[0, 0, segmentZ]}>
            {/* Road surface */}
            <Plane 
              args={[TRACK_WIDTH, 50]} 
              rotation={[-Math.PI / 2, 0, 0]} 
              receiveShadow
            >
              <meshStandardMaterial 
                color="#2c2c2c" 
                roughness={0.9}
                metalness={0.1}
              />
            </Plane>
            
            {/* Side lines */}
            <Plane args={[0.2, 50]} position={[-TRACK_WIDTH/2, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.2} />
            </Plane>
            <Plane args={[0.2, 50]} position={[TRACK_WIDTH/2, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.2} />
            </Plane>
            
            {/* Lane markers */}
            {LANE_POSITIONS.slice(0, -1).map((pos, j) => (
              <group key={j}>
                {Array.from({ length: 5 }).map((_, k) => (
                  <Plane 
                    key={k}
                    args={[0.1, 4]} 
                    position={[(pos + LANE_POSITIONS[j + 1]) / 2, 0.01, -k * 10 - 2]} 
                    rotation={[-Math.PI / 2, 0, 0]}
                  >
                    <meshStandardMaterial 
                      color="yellow" 
                      emissive="yellow" 
                      emissiveIntensity={0.3}
                    />
                  </Plane>
                ))}
              </group>
            ))}
            
            {/* Roadside barriers */}
            {Array.from({ length: 10 }).map((_, j) => (
              <group key={`barrier-${j}`}>
                <Box 
                  args={[0.3, 1, 0.3]} 
                  position={[-TRACK_WIDTH/2 - 0.8, 0.5, -j * 5]} 
                  castShadow
                >
                  <meshStandardMaterial color="#ff4444" emissive="#ff0000" emissiveIntensity={0.1} />
                </Box>
                <Box 
                  args={[0.3, 1, 0.3]} 
                  position={[TRACK_WIDTH/2 + 0.8, 0.5, -j * 5]} 
                  castShadow
                >
                  <meshStandardMaterial color="#ff4444" emissive="#ff0000" emissiveIntensity={0.1} />
                </Box>
              </group>
            ))}
          </group>
        );
      })}
      
      {/* Render obstacles */}
      {obstacles?.map((obstacle: any) => {
        if (Math.abs(obstacle.position - trackPosition) > 100) return null;
        
        return (
          <Box
            key={obstacle.id}
            args={[0.6, 0.6, 0.6]}
            position={[LANE_POSITIONS[obstacle.lane] || 0, 0.3, -obstacle.position]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial 
              color={obstacle.type === 'oil' ? '#333333' : '#ff4444'} 
              emissive={obstacle.type === 'barrier' ? '#ff0000' : '#000000'} 
              emissiveIntensity={0.2}
              metalness={obstacle.type === 'oil' ? 0.9 : 0.3}
              roughness={obstacle.type === 'oil' ? 0.1 : 0.7}
            />
          </Box>
        );
      })}
      
      {/* Render power-ups */}
      {powerUps?.map((powerUp: any) => {
        if (powerUp.collected || Math.abs(powerUp.position - trackPosition) > 100) return null;
        
        const colors: any = {
          boost: '#00ff00',
          shield: '#00ffff',
          magnet: '#ff00ff',
          missile: '#ff0000'
        };
        
        return (
          <group key={powerUp.id} position={[LANE_POSITIONS[powerUp.lane] || 0, 0.5, -powerUp.position]}>
            <Box args={[0.8, 0.1, 2]}>
              <meshStandardMaterial 
                color={colors[powerUp.type]} 
                emissive={colors[powerUp.type]} 
                emissiveIntensity={0.5}
                transparent
                opacity={0.8}
              />
            </Box>
            {/* Floating icon */}
            <Box 
              args={[0.4, 0.4, 0.4]} 
              position={[0, Math.sin(Date.now() * 0.003) * 0.2 + 0.5, 0]}
            >
              <meshStandardMaterial 
                color={colors[powerUp.type]}
                emissive={colors[powerUp.type]}
                emissiveIntensity={0.8}
              />
            </Box>
          </group>
        );
      })}
    </group>
  );
}

function Racing3D({ game, socket, room, player, playerId }: Racing3DProps) {
  const [gameState, setGameState] = useState(game.state);
  const [result, setResult] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'follow' | 'top' | 'first-person'>('follow');
  const [countdown, setCountdown] = useState(game.state?.countdown ?? 3);
  
  // Input handling with continuous updates
  const keysPressed = useRef<Set<string>>(new Set());
  const inputUpdateInterval = useRef<NodeJS.Timeout>();
  
  // Initialize countdown from game state
  useEffect(() => {
    if (game.state?.countdown !== undefined) {
      setCountdown(game.state.countdown);
    }
  }, []);

  useEffect(() => {
    const handleGameUpdate = (data: any) => {
      console.log('Game update received:', data);
      if (data.game?.id === game.id || data.game?.state) {
        setGameState(data.game.state);
        if (data.game.state?.countdown !== undefined) {
          setCountdown(data.game.state.countdown);
        }
      }
    };

    const handleGameEnded = (data: any) => {
      if (data.game?.id === game.id) {
        if (data.winner === playerId) {
          setResult('win');
        } else if (data.draw) {
          setResult('draw');
        } else {
          setResult('lose');
        }
      }
    };

    socket.socket?.on('gameUpdate', handleGameUpdate);
    socket.socket?.on('gameEnded', handleGameEnded);

    return () => {
      socket.socket?.off('gameUpdate', handleGameUpdate);
      socket.socket?.off('gameEnded', handleGameEnded);
    };
  }, [socket, game.id, playerId]);

  // Continuous input sending
  const sendInputs = useCallback(() => {
    if (!socket.socket?.connected) return;
    
    const inputs = {
      accelerate: keysPressed.current.has('ArrowUp') || keysPressed.current.has('w') || keysPressed.current.has('W'),
      brake: keysPressed.current.has('ArrowDown') || keysPressed.current.has('s') || keysPressed.current.has('S'),
      left: keysPressed.current.has('ArrowLeft') || keysPressed.current.has('a') || keysPressed.current.has('A'),
      right: keysPressed.current.has('ArrowRight') || keysPressed.current.has('d') || keysPressed.current.has('D'),
      boost: keysPressed.current.has(' '),
      drift: keysPressed.current.has('Shift')
    };
    
    // Send without waiting for response
    socket.socket.emit('gameAction', { type: 'input', inputs }, () => {});
  }, [socket]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Camera switching
      if (e.key === 'c' || e.key === 'C') {
        setCameraMode(prev => {
          if (prev === 'follow') return 'top';
          if (prev === 'top') return 'first-person';
          return 'follow';
        });
        return;
      }
      
      // Add key to pressed set
      if (!keysPressed.current.has(e.key)) {
        keysPressed.current.add(e.key);
        
        // Special actions
        if (e.key === ' ' && socket.socket?.connected) {
          socket.socket.emit('gameAction', { type: 'boost' }, () => {});
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Start continuous input updates (20Hz to match server update rate)
    inputUpdateInterval.current = setInterval(sendInputs, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (inputUpdateInterval.current) {
        clearInterval(inputUpdateInterval.current);
      }
    };
  }, [sendInputs, socket]);

  const myCarData = gameState?.players?.[playerId];
  
  const allPlayers = useMemo(() => {
    if (!gameState?.players) return [];
    
    return Object.entries(gameState.players).map(([id, data]: [string, any]) => ({
      id,
      data,
      color: PLAYER_COLORS[game.players.indexOf(id) % PLAYER_COLORS.length],
      name: `P${game.players.indexOf(id) + 1}`
    }));
  }, [gameState?.players, game.players]);

  const sortedPlayers = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
      const aPos = a.data?.position || 0;
      const bPos = b.data?.position || 0;
      return bPos - aPos;
    });
  }, [allPlayers]);

  const progress = myCarData ? (myCarData.position / TRACK_LENGTH) * 100 : 0;

  return (
    <div className="racing-3d">
      <div className="game-hud">
        {/* Countdown overlay */}
        {countdown > 0 && gameState?.raceStarted === false && (
          <div className="countdown-overlay">
            <div className="countdown-number">{countdown}</div>
          </div>
        )}
        
        <div className="controls-panel">
          <h3>Controls</h3>
          <div className="control-list">
            <p>↑/W: Accelerate</p>
            <p>↓/S: Brake</p>
            <p>←/A: Left</p>
            <p>→/D: Right</p>
            <p>Space: Boost</p>
            <p>Shift: Drift</p>
            <p>C: Camera</p>
          </div>
        </div>
        
        <div className="race-stats">
          <div className="speedometer">
            <div className="speed-value">{Math.round((myCarData?.speed || 0) * 15)}</div>
            <div className="speed-unit">km/h</div>
          </div>
          
          <div className="boost-indicator">
            {Array.from({ length: 5 }).map((_, i) => (
              <div 
                key={i} 
                className={`boost-pip ${i < (myCarData?.boosts || 0) ? 'active' : ''}`}
                style={{
                  animation: myCarData?.isBoosting ? 'pulse 0.5s infinite' : undefined
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Progress indicator - bottom left */}
        <div className="progress-indicator-bottom">
          <div className="progress-label">Progress</div>
          <div className="progress-bar-mini">
            <div 
              className="progress-fill-mini" 
              style={{ 
                width: `${Math.min(100, progress)}%`,
                background: myCarData?.isBoosting 
                  ? 'linear-gradient(90deg, #00ffff 0%, #ff00ff 100%)' 
                  : 'linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%)'
              }}
            />
          </div>
          <div className="progress-text-mini">{Math.round(Math.min(100, progress))}%</div>
        </div>
        
        <div className="leaderboard">
          <h4>Positions</h4>
          <div className="player-list">
            {sortedPlayers.map((player, index) => (
              <div 
                key={player.id} 
                className={`player-item ${player.id === playerId ? 'current' : ''}`}
              >
                <span className="position">{index + 1}.</span>
                <span className="player-name" style={{ color: player.color }}>
                  {player.name}
                </span>
                <span className="player-distance">
                  {Math.round(player.data?.position || 0)}m
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {result && (
          <div className={`result-overlay result-${result}`}>
            <div className="result-content">
              <h2>
                {result === 'win' && '🏆 Victory! 🏆'}
                {result === 'lose' && '💀 Defeated! 💀'}
                {result === 'draw' && '🤝 Draw! 🤝'}
              </h2>
              <p>
                {result === 'win' && 'You are the champion!'}
                {result === 'lose' && 'Your confession will be revealed!'}
                {result === 'draw' && 'No winner this time!'}
              </p>
            </div>
          </div>
        )}
      </div>
      
      <div className="canvas-container">
        <Canvas 
          shadows 
          dpr={[1, 2]} 
          performance={{ min: 0.5, max: 1 }}
          gl={{ 
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
          }}
        >
          <PerspectiveCamera 
            makeDefault 
            position={[0, 8, 15]} 
            fov={60}
            near={0.1}
            far={1000}
          />
          
          <SmoothCameraController 
            carPosition={myCarData?.position} 
            carLane={myCarData?.lane} 
            cameraMode={cameraMode}
          />
          
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-far={100}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
          />
          
          {/* Environment */}
          <Sky 
            distance={450000}
            sunPosition={[100, 20, 100]}
            inclination={0.6}
            azimuth={0.25}
          />
          <fog attach="fog" args={['#87CEEB', 30, 300]} />
          
          {/* Dynamic clouds */}
          <Cloud
            position={[-20, 15, -30]}
            speed={0.2}
            opacity={0.5}
            scale={[10, 5, 10]}
          />
          <Cloud
            position={[20, 12, -50]}
            speed={0.3}
            opacity={0.4}
            scale={[8, 4, 8]}
          />
          
          {/* Track and environment */}
          <DynamicTrack 
            obstacles={gameState?.obstacles || []} 
            trackPosition={myCarData?.position || 0}
            powerUps={gameState?.powerUps || []}
          />
          
          {/* All player cars with interpolation */}
          {allPlayers.map((player, index) => {
            const lanePosition = LANE_POSITIONS[Math.floor(player.data?.lane || 0)] || 0;
            const laneOffset = (player.data?.laneOffset || 0) * 1.5;
            
            return (
              <InterpolatedCar
                key={player.id}
                targetPosition={[
                  lanePosition + laneOffset,
                  0.25,
                  -(player.data?.position || 0)
                ]}
                color={player.color}
                isPlayer={player.id === playerId}
                playerName={player.name}
                carIndex={index}
                nitroActive={player.data?.nitroActive}
                crashed={player.data?.crashed}
              />
            );
          })}
        </Canvas>
      </div>
    </div>
  );
}

export default Racing3D;