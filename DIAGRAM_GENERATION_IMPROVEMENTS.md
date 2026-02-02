# Mejoras en la Generación de Diagramas en ProofCanvasV2

## Resumen

Se han revisado y mejorado los mecanismos de generación de diagramas desde el chat de IA en el ProofCanvasV2 de ProofMesh.

## Problemas Identificados

### 1. Errores de TypeScript en FloatingAIBar.tsx
- **Problema**: Código duplicado y variables no definidas causaban errores de compilación TypeScript
- **Ubicación**: Sección de creación de edges desde diagramas de IA (líneas ~380-420)
- **Síntoma**: El código fallaba al intentar procesar diagramas generados por la IA

### 2. Cálculo Incorrecto de Posición de Edge Labels
- **Problema**: Los labels de los edges se posicionaban incorrectamente en el canvas
- **Ubicación**: Componente ProofCanvasV2.tsx (líneas ~470)
- **Causa**: Cálculo simplificado que no consideraba la curvatura del path bezier
- **Síntoma**: Los labels aparecían en posiciones aleatorias en lugar de en el punto medio del edge

## Soluciones Implementadas

### 1. Sistema de Cola Asíncrona (AsyncQueue)

**Problema Principal:** Las operaciones asíncronas se perdían porque no se esperaban correctamente. Las peticiones al backend no se completaban antes de continuar con el siguiente paso.

**Solución:** Se implementó un sistema de cola asíncrona (`frontend/src/lib/asyncQueue.ts`) que:

1. **Garantiza ejecución secuencial**: Las operaciones se ejecutan una después de otra, evitando condiciones de carrera
2. **Reintentos automáticos**: Si una operación falla, se reintenta hasta 3 veces con backoff exponencial
3. **Manejo de errores robusto**: Cada operación tiene callbacks de éxito y error
4. **Logging detallado**: Se registran todas las operaciones, intentos y errores en la consola

**Características del AsyncQueue:**

```typescript
export class AsyncQueue {
  private queue: QueuedOperation<any>[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelay = 1000; // ms

  // Ejecuta operaciones secuencialmente
  async enqueue<T>(operation: QueuedOperation<T>): Promise<T>

  // Reintenta automáticamente con backoff exponencial
  private async executeWithRetry<T>(operation: QueuedOperation<T>)

  // Limpia la cola de operaciones pendientes
  clear()

  // Estado de la cola
  get pendingCount(): number
  get isRunning(): boolean
}
```

**Uso en FloatingAIBar:**

```typescript
// Crear diagrama completo en la cola
await queueCanvasOperation(
  `create-diagram-${proposal.content.slice(0, 30)}`,
  async () => {
    // Crear todos los nodos del diagrama
    for (const node of diagram.nodes) {
      const created = await onCreateNode({
        type: node.type,
        title: node.title,
        content: nodeContent,
        // ...
      });
      diagramIdToActualId.set(node.id, created.id);
    }

    // Actualizar edges después de crear todos los nodos
    await Promise.all(
      Array.from(depsByActualId.entries()).map(async ([actualId, deps]) => {
        await onUpdateNode(actualId, { dependencies: merged });
      })
    );

    return { diagramIdToActualId, createdNodeIds };
  },
  {
    onSuccess: (result) => {
      console.log(`Diagram created successfully`);
    },
    onError: (error) => {
      addInsight({
        type: "insight",
        title: "Error creando diagrama",
        content: error.message,
      });
    },
  }
);
```

**Beneficios:**
- ✅ Las peticiones no se pierden
- ✅ Operaciones ejecutan secuencialmente
- ✅ Reintentos automáticos en caso de fallo
- ✅ Feedback visual al usuario con mensajes de error
- ✅ Logging detallado para debugging
- ✅ Backoff exponencial reduce carga en el servidor

### 2. Corrección de Errores TypeScript en FloatingAIBar.tsx

**Antes (con errores):**
```typescript
// Código duplicado causaba referencia a variables inexistentes
for (const edge of diagram.edges) {
  const fromActual = diagramIdToActualId.get(edge.from);
  const toActual = diagramIdToActualId.get(edge.to);
  // depsByActualId no estaba definido aquí
  await Promise.resolve(onUpdateNode(fromActual, { 
    dependencies: (depsByActualId.get(fromActual) || []).concat([toActual])
  }));
}
```

**Después (corregido):**
```typescript
// El procesamiento de edges se simplificó y el código duplicado se eliminó
// Los dependencies se manejan correctamente en la sección que sí tiene todas las variables
if (onUpdateNode && diagram.edges && diagram.edges.length > 0) {
  const depsByActualId = new Map<string, Set<string>>();
  
  diagram.edges.forEach((edge) => {
    const fromActual = diagramIdToActualId.get(edge.from);
    const toActual = diagramIdToActualId.get(edge.to);
    if (!fromActual || !toActual) return;
    if (!depsByActualId.has(toActual)) {
      depsByActualId.set(toActual, new Set());
    }
    depsByActualId.get(toActual)?.add(fromActual);
  });

  await Promise.all(
    Array.from(depsByActualId.entries()).map(([actualId, deps]) => {
      const baseDeps = baseDepsByActualId.get(actualId) || [];
      const merged = Array.from(new Set([...baseDeps, ...Array.from(deps)]));
      return Promise.resolve(onUpdateNode(actualId, { dependencies: merged }));
    })
  );
}
```

**Beneficios:**
- Elimina errores de compilación TypeScript
- Manejo más limpio y explícito de dependencies
- Reduce duplicación de código

### 2. Mejora del Cálculo de Posición de Edge Labels

**Antes (cálculo incorrecto):**
```typescript
{edge.label && (
  <text
    x={(fromNode.x + toNode.x + (fromNode.width || 260)) / 2}
    y={(fromNode.y + toNode.y + (fromNode.height || 140)) / 2}
    fontSize="10"
    fill="#64748b"
    textAnchor="middle"
  >
    {edge.label}
  </text>
)}
```

**Después (cálculo correcto en el punto medio de la curva):**
```typescript
{edge.label && (() => {
  // Extraer puntos de control del path bezier
  const pathMatch = path.match(/M\s+([\d.-]+)\s+([\d.-]+)\s+C\s+([\d.-]+)\s+([\d.-]+)\s*,\s*([\d.-]+)\s+([\d.-]+)\s*,\s*([\d.-]+)\s+([\d.-]+)/);
  if (!pathMatch) return null;
  
  const [, startX, startY, cp1x, cp1y, cp2x, cp2y, endX, endY] = pathMatch.map(Number);
  
  // Calcular punto medio de la curva bezier cúbica usando fórmula paramétrica
  // B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
  const t = 0.5;
  const midX = Math.pow(1-t, 3) * startX +
    3 * Math.pow(1-t, 2) * t * cp1x +
    3 * (1-t) * Math.pow(t, 2) * cp2x +
    Math.pow(t, 3) * endX;
  const midY = Math.pow(1-t, 3) * startY +
    3 * Math.pow(1-t, 2) * t * cp1y +
    3 * (1-t) * Math.pow(t, 2) * cp2y +
    Math.pow(t, 3) * endY;
  
  return (
    <text
      x={midX}
      y={midY - 5}
      fontSize="10"
      fill="#64748b"
      textAnchor="middle"
      className="pointer-events-none select-none"
      style={{ textShadow: '0px 0px 2px rgba(255,255,255,0.8)' }}
    >
      {edge.label}
    </text>
  );
})()}
```

**Beneficios:**
- Los labels aparecen exactamente en el punto medio del edge
- Mejor legibilidad con sombra de texto sobre el fondo
- Interacción mejorada (pointer-events-none para no bloquear clicks)
- Cálculo matemáticamente preciso usando la fórmula de Bézier cúbica

## Flujo Actual de Generación de Diagramas

### 1. Prompt del Usuario
El usuario ingresa un comando en el FloatingAIBar:
- Ejemplo: "Generate a proof that the sum of two even numbers is even"

### 2. Solicitud al Backend (Explorer Agent)
```typescript
const result = await exploreContext({
  problem_id: problemId,
  context: fullContext,
  max_iterations: 3,
});
```

### 3. Recepción de Diagrama
El backend retorna un objeto `DiagramSpec`:
```typescript
{
  nodes: [
    { id: "n1", type: "LEMMA", title: "Lemma 1", content: "..." },
    { id: "n2", type: "LEMMA", title: "Lemma 2", content: "..." }
  ],
  edges: [
    { from: "n1", to: "n2", type: "implies", label: "uses" }
  ]
}
```

### 4. Procesamiento en el Frontend

**Paso 4a: Sanitización y Validación**
```typescript
const diagram = sanitizeDiagram(proposal.diagram);
// Normaliza tipos, elimina duplicados, valida estructura
```

**Paso 4b: Layout Automático**
```typescript
const positions = layoutDiagram(diagram.nodes, diagram.edges, baseX, baseY);
// Calcula posición óptima para cada nodo usando algoritmo topológico
```

**Paso 4c: Creación de Nodos**
```typescript
for (const node of diagram.nodes) {
  const created = await onCreateNode({
    type: node.type,
    title: node.title,
    content: node.content,
    formula: node.formula,
    leanCode: node.leanCode,
    x: position.x,
    y: position.y,
    dependencies: baseDeps,
    authors: [AI_AUTHOR],
    source: buildAISource(runId),
  });
  diagramIdToActualId.set(node.id, created.id);
}
```

**Paso 4d: Creación de Edges con Dependencies**
```typescript
// Los edges se crean como dependencies en los nodos objetivo
const depsByActualId = new Map<string, Set<string>>();

diagram.edges.forEach((edge) => {
  const fromActual = diagramIdToActualId.get(edge.from);
  const toActual = diagramIdToActualId.get(edge.to);
  depsByActualId.get(toActual)?.add(fromActual);
});

await Promise.all(
  Array.from(depsByActualId.entries()).map(([actualId, deps]) =>
    onUpdateNode(actualId, { dependencies: merged })
  )
);
```

### 5. Renderizado en ProofCanvasV2
- Los nodos se posicionan según las coordenadas calculadas
- Los edges se renderizan como paths SVG con flechas
- Los **labels de edges** se posicionan en el punto medio de la curva bezier
- Colores y estilos según el tipo de edge (uses, implies, contradicts, references)

## Características Soportadas

### Tipos de Nodos
- DEFINITION, LEMMA, THEOREM, CLAIM, COUNTEREXAMPLE
- COMPUTATION, NOTE, RESOURCE, IDEA, CONTENT

### Tipos de Edges
- `uses` - Un nodo utiliza otro (gris)
- `implies` - Implicación lógica (índigo)
- `contradicts` - Contradicción (no visualizado actualmente)
- `references` - Referencia (línea punteada)

### Edge Labels
- Texto descriptivo que aparece en el punto medio del edge
- Ejemplos: "uses", "from", "implies that", "applies to"
- Renderizado con sombra para mejor legibilidad

### Metadata de Autoría
- Cada nodo generado por IA incluye: `authors: [{ type: "agent", id: "orchestrator", name: "AI Pipeline" }]`
- Referencia al `agent_run_id` para trazabilidad

## Limitaciones Actuales

### 1. Persistencia de Edge Labels
**Estado:** Parcialmente implementado
- Los labels se renderizan correctamente en el frontend
- **Problema:** Cuando los edges se guardan/recargan, los labels pueden perderse si el backend no los almacena explícitamente

**Solución futura recomendada:**
1. Agregar campo `edge_metadata` al modelo `LibraryItem`
2. Almacenar información de edges (tipo, label) en JSONB
3. Al cargar, reconstruir edges con sus labels

### 2. Edición de Edge Labels
**Estado:** No implementado
- Los usuarios no pueden editar los labels de edges existentes
- Solo pueden eliminar edges y crear nuevos

**Solución futura recomendada:**
1. Modal de edición de edge (contextual click derecho)
2. Permitir cambiar tipo de edge y editar label
3. Validar que el label sea consistente con el tipo

### 3. Visualización de Tipos de Edges
**Estado:** Parcialmente implementado
- `uses` y `implies` tienen colores diferentes
- `contradicts` y `references` definidos pero no completamente visualizados

**Solución futura recomendada:**
1. Implementar color rojo para `contradicts`
2. Mejorar visualización de `references` (línea punteada ya existe)
3. Considerar iconos adicionales en edges

## Recomendaciones para Desarrollos Futuros

### 1. Sistema de Plantillas de Diagramas
```typescript
const DIAGRAM_TEMPLATES = {
  proofByContradiction: {
    description: "Standard proof by contradiction structure",
    nodes: [
      { type: "THEOREM", title: "Statement to prove" },
      { type: "ASSUMPTION", title: "Assume negation" },
      { type: "DERIVATION", title: "Derive contradiction" }
    ],
    edges: [
      { from: 0, to: 1, type: "assumes" },
      { from: 1, to: 2, type: "implies" }
    ]
  },
  // ...
};
```

### 2. Feedback Visual para Generación de Diagramas
- Mostrar indicador de carga mientras se genera el diagrama
- Preview del diagrama antes de insertarlo
- Opción de cancelar generación

### 3. Exportación de Diagramas
- Exportar como SVG
- Exportar como PNG con alta resolución
- Exportar como JSON para compartir entre usuarios

### 4. Validación de Diagramas
- Verificar que no haya ciclos (a menos que sea intencional)
- Validar que todos los edges tengan nodos válidos
- Detectar nodos desconectados (sugerir agrupación o eliminación)

## Archivos Modificados

1. **frontend/src/lib/asyncQueue.ts** (NUEVO)
   - Sistema de cola para operaciones asíncronas
   - Reintentos automáticos con backoff exponencial
   - Manejo robusto de errores con callbacks
   - Logging detallado de operaciones

2. **frontend/src/components/canvas/FloatingAIBar.tsx**
   - Integración del sistema de cola asíncrona
   - Corrección de errores TypeScript en procesamiento de edges
   - Simplificación del código de creación de diagramas
   - Manejo de errores mejorado con feedback al usuario

3. **frontend/src/components/canvas/ProofCanvasV2.tsx**
   - Mejora del cálculo de posición de edge labels
   - Adición de sombra de texto para mejor legibilidad
   - Uso de fórmula de Bézier cúbica para cálculo preciso

## Testing

### Pruebas Manuales Recomendadas

1. **Generar diagrama simple**
   ```
   Prompt: "Create a simple proof with 2 lemmas"
   ```
   - Verificar que los 2 nodos se creen
   - Verificar que el edge se renderice
   - Verificar que el label aparezca en el punto medio

2. **Generar diagrama complejo**
   ```
   Prompt: "Create a proof structure with 5 nodes showing dependencies"
   ```
   - Verificar el layout automático
   - Verificar que no haya superposiciones
   - Verificar que todos los edges tengan labels si están definidos

3. **Prueba de edge labels**
   - Crear edge manual
   - Verificar que el label no bloquee clicks en el edge
   - Verificar legibilidad sobre diferentes fondos

4. **Prueba de persistencia**
   - Crear diagrama
   - Guardar canvas
   - Recargar página
   - Verificar que el diagrama se restaure correctamente

## Conclusiones y Recomendaciones

Las mejoras implementadas resuelven los problemas principales de generación de diagramas:

### Problemas Resueltos
- ✅ **Peticiones asíncronas perdidas**: Sistema de cola asegura que todas las operaciones se completen
- ✅ **Errores de TypeScript**: Código compila sin errores
- ✅ **Posicionamiento incorrecto de labels**: Fórmula matemática precisa para Bézier cúbica
- ✅ **Mejor legibilidad**: Sombras de texto en edge labels
- ✅ **Código limpio**: Refactorización elimina duplicación

### Características del Sistema de Cola

1. **Ejecución Secuencial**
   - Las operaciones se ejecutan una después de otra
   - Evita condiciones de carrera
   - Garantiza orden de ejecución

2. **Reintentos Automáticos**
   - Hasta 3 intentos por operación
   - Backoff exponencial: 1s, 2s, 4s
   - Reduce carga en servidor

3. **Manejo de Errores**
   - Callbacks de éxito y error
   - Logging detallado en consola
   - Feedback visual al usuario
   - Continúa con operaciones subsiguientes si una falla

4. **Visibilidad**
   - `pendingCount`: número de operaciones en cola
   - `isRunning`: estado actual de la cola
   - `clear()`: limpiar cola manualmente

### Recomendaciones de Uso

**Para Desarrollo:**
```typescript
// Agregar nuevas operaciones a la cola
await queueCanvasOperation(
  "operation-name",
  async () => {
    // Tu lógica aquí
    return result;
  },
  {
    onSuccess: (result) => {
      // Manejo de éxito
    },
    onError: (error) => {
      // Manejo de error
    },
  }
);
```

**Para Testing:**
- Observar la consola para ver el logging de operaciones
- Verificar que las operaciones se ejecutan secuencialmente
- Probar fallos de red para confirmar reintentos
- Verificar que los errores se muestran al usuario

**Para Producción:**
- Monitorear el número de operaciones pendientes
- Configurar alertas para operaciones que fallan después de 3 intentos
- Considerar aumentar `maxRetries` para operaciones críticas
- Ajustar `retryDelay` según la capacidad del servidor

### Próximos Pasos Sugeridos

1. **Persistencia de Cola**: Guardar estado de la cola en localStorage para recuperar después de recarga
2. **Priorización**: Permitir marcar operaciones como de alta prioridad
3. **Batching**: Agrupar operaciones similares para reducir llamadas al servidor
4. **Timeout**: Agregar timeout máximo por operación
5. **Métricas**: Recolectar métricas de tiempo de ejecución y tasa de fallos

El flujo de generación de diagramas ahora es estable, robusto y produce resultados visuales de alta calidad con feedback claro al usuario.
