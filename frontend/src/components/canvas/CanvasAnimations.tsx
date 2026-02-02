"use client";

import { ReactNode, useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";

// ============================================
// Animaciones específicas para nodos del canvas
// ============================================

interface NodeEntranceProps {
  children: ReactNode;
  nodeId: string;
  delay?: number;
  className?: string;
}

export function NodeEntrance({ 
  children, 
  nodeId, 
  delay = 0, 
  className = "" 
}: NodeEntranceProps) {
  return (
    <motion.div
      key={nodeId}
      layoutId={`node-${nodeId}`}
      initial={{ 
        opacity: 0, 
        scale: 0.6,
        y: 40,
        rotateX: -15
      }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        y: 0,
        rotateX: 0
      }}
      exit={{ 
        opacity: 0, 
        scale: 0.8,
        y: -20,
        transition: { duration: 0.2 }
      }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 25,
        delay
      }}
      whileHover={{
        scale: 1.02,
        transition: { type: "spring", stiffness: 400, damping: 25 }
      }}
      whileTap={{
        scale: 0.98
      }}
      className={className}
      style={{ perspective: 1000 }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Efecto de conexión animada entre nodos
// ============================================

interface AnimatedConnectionProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isNew?: boolean;
  isActive?: boolean;
  color?: string;
}

export function AnimatedConnection({
  fromX,
  fromY,
  toX,
  toY,
  isNew = false,
  isActive = false,
  color = "#6366f1"
}: AnimatedConnectionProps) {
  // Calculate bezier curve
  const midX = (fromX + toX) / 2;
  const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <defs>
        <linearGradient id={`gradient-${fromX}-${toX}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="50%" stopColor={color} stopOpacity={0.8} />
          <stop offset="100%" stopColor={color} stopOpacity={0.3} />
        </linearGradient>
        <marker
          id={`arrow-${fromX}-${toX}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill={color} />
        </marker>
      </defs>
      
      {/* Background path */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeOpacity={0.2}
        initial={isNew ? { pathLength: 0 } : { pathLength: 1 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      
      {/* Animated flowing line */}
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#gradient-${fromX}-${toX})`}
        strokeWidth="2"
        initial={isNew ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
        animate={isActive ? {
          pathLength: [0, 1],
          opacity: [0, 1, 0]
        } : {
          pathLength: 1,
          opacity: 1
        }}
        transition={isActive ? {
          pathLength: { duration: 1.5, repeat: Infinity, ease: "linear" },
          opacity: { duration: 1.5, repeat: Infinity, ease: "linear" }
        } : {
          duration: 0.6
        }}
        markerEnd={`url(#arrow-${fromX}-${toX})`}
      />
    </svg>
  );
}

// ============================================
// Efecto de selección con halo
// ============================================

interface SelectionHaloProps {
  children: ReactNode;
  isSelected: boolean;
  color?: string;
  className?: string;
}

export function SelectionHalo({ 
  children, 
  isSelected, 
  color = "#6366f1",
  className = "" 
}: SelectionHaloProps) {
  return (
    <div className={`relative ${className}`}>
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute -inset-1 rounded-xl pointer-events-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: [0.4, 0.7, 0.4],
              scale: [1, 1.02, 1]
            }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
            style={{
              boxShadow: `0 0 20px 3px ${color}40, inset 0 0 20px 3px ${color}20`,
            }}
          />
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}

// ============================================
// Efecto de drag con sombra
// ============================================

interface DraggableNodeProps {
  children: ReactNode;
  isDragging: boolean;
  className?: string;
}

export function DraggableNode({ 
  children, 
  isDragging, 
  className = "" 
}: DraggableNodeProps) {
  return (
    <motion.div
      className={className}
      animate={isDragging ? {
        scale: 1.05,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        zIndex: 50
      } : {
        scale: 1,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        zIndex: 1
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Efecto de hover en nodos
// ============================================

interface HoverableNodeProps {
  children: ReactNode;
  className?: string;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

export function HoverableNode({ 
  children, 
  className = "",
  onHoverStart,
  onHoverEnd
}: HoverableNodeProps) {
  return (
    <motion.div
      className={className}
      whileHover={{
        y: -4,
        transition: { type: "spring", stiffness: 400, damping: 25 }
      }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
    >
      <motion.div
        whileHover={{
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.15)",
        }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ============================================
// Efecto de creación de conexión
// ============================================

interface ConnectionCreationEffectProps {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isVisible: boolean;
}

export function ConnectionCreationEffect({
  startX,
  startY,
  currentX,
  currentY,
  isVisible
}: ConnectionCreationEffectProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.line
            x1={startX}
            y1={startY}
            x2={currentX}
            y2={currentY}
            stroke="#6366f1"
            strokeWidth="2"
            strokeDasharray="8,4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
          />
          <motion.circle
            cx={currentX}
            cy={currentY}
            r="6"
            fill="#6366f1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Efecto de partículas para acciones especiales
// ============================================

interface ParticleBurstProps {
  x: number;
  y: number;
  color?: string;
  particleCount?: number;
  trigger: boolean;
}

export function ParticleBurst({ 
  x, 
  y, 
  color = "#6366f1",
  particleCount = 12,
  trigger 
}: ParticleBurstProps) {
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    angle: (i / particleCount) * 360,
    distance: 30 + Math.random() * 30
  }));

  return (
    <AnimatePresence>
      {trigger && (
        <div className="absolute pointer-events-none" style={{ left: x, top: y }}>
          {particles.map((particle) => {
            const rad = (particle.angle * Math.PI) / 180;
            const destX = Math.cos(rad) * particle.distance;
            const destY = Math.sin(rad) * particle.distance;

            return (
              <motion.div
                key={particle.id}
                className="absolute w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                animate={{
                  x: destX,
                  y: destY,
                  scale: 0,
                  opacity: 0
                }}
                transition={{
                  duration: 0.6,
                  ease: "easeOut"
                }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Efecto de pulso para elementos importantes
// ============================================

interface AttentionPulseProps {
  children: ReactNode;
  isActive?: boolean;
  color?: string;
  className?: string;
}

export function AttentionPulse({ 
  children, 
  isActive = true, 
  color = "#f59e0b",
  className = "" 
}: AttentionPulseProps) {
  return (
    <div className={`relative ${className}`}>
      {isActive && (
        <>
          <motion.div
            className="absolute inset-0 rounded-xl"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              boxShadow: `0 0 0 2px ${color}`
            }}
          />
          <motion.div
            className="absolute -inset-1 rounded-xl"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3
            }}
            style={{
              boxShadow: `0 0 0 2px ${color}`
            }}
          />
        </>
      )}
      {children}
    </div>
  );
}

// ============================================
// Efecto de shimmer para contenido en carga
// ============================================

interface ShimmerEffectProps {
  children: ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function ShimmerEffect({ 
  children, 
  isLoading = true, 
  className = "" 
}: ShimmerEffectProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {children}
      {isLoading && (
        <motion.div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
            backgroundSize: "200% 100%"
          }}
          animate={{
            backgroundPosition: ["200% 0", "-200% 0"]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Efecto de borde animado
// ============================================

interface AnimatedBorderProps {
  children: ReactNode;
  isActive?: boolean;
  colors?: string[];
  className?: string;
}

export function AnimatedBorder({ 
  children, 
  isActive = true,
  colors = ["#6366f1", "#a855f7", "#ec4899", "#6366f1"],
  className = "" 
}: AnimatedBorderProps) {
  return (
    <div className={`relative ${className}`}>
      {isActive && (
        <motion.div
          className="absolute -inset-[2px] rounded-xl"
          style={{
            background: `linear-gradient(90deg, ${colors.join(", ")})`,
            backgroundSize: "300% 100%"
          }}
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      )}
      <div className="relative bg-white rounded-xl">
        {children}
      </div>
    </div>
  );
}

// ============================================
// Efecto de flotación suave
// ============================================

interface FloatingElementProps {
  children: ReactNode;
  amplitude?: number;
  duration?: number;
  className?: string;
}

export function FloatingElement({ 
  children, 
  amplitude = 8, 
  duration = 3,
  className = "" 
}: FloatingElementProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [-amplitude, amplitude, -amplitude]
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Transición de layout suave
// ============================================

interface LayoutTransitionProps {
  children: ReactNode;
  className?: string;
}

export function LayoutTransition({ children, className = "" }: LayoutTransitionProps) {
  return (
    <motion.div
      layout
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// Contador animado
// ============================================

interface AnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({ 
  value, 
  className = "",
  duration = 0.5 
}: AnimatedCounterProps) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={className}
    >
      {value}
    </motion.span>
  );
}

// ============================================
// Efecto de onda al hacer clic
// ============================================

interface RippleButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function RippleButton({ 
  children, 
  onClick,
  className = "" 
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    
    setRipples((prev) => [...prev, { x, y, id }]);
    
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
    
    onClick?.();
  };

  return (
    <button
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
    >
      {children}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 20, opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      ))}
    </button>
  );
}
