#!/bin/bash
set -e

cd /workspace/mesh_project

# Configurar límites de paralelismo para no consumir todo el CPU
# Por defecto usa solo 2 jobs para lake y leantar
export LAKE_JOBS="${LAKE_JOBS:-2}"
export LEANTAR_JOBS="${LEANTAR_JOBS:-2}"

# Función para ejecutar lake con baja prioridad (nice)
run_nice() {
    nice -n 10 "$@"
}

# Verificar si ya está inicializado el proyecto
if [ ! -d ".lake/packages/mathlib" ]; then
    echo "========================================="
    echo "Inicializando Mathlib (primera vez)..."
    echo "Esto puede tomar varios minutos."
    echo "Usando $LAKE_JOBS jobs paralelos"
    echo "========================================="
    
    # Ejecutar lake update con baja prioridad y jobs limitados
    echo "→ Ejecutando lake update..."
    run_nice lake update --jobs "$LAKE_JOBS" || {
        echo "⚠️  lake update falló, intentando continuar..."
    }
    
    # Descargar cache con jobs limitados
    echo "→ Descargando cache de Mathlib..."
    run_nice lake exe cache get --jobs "$LEANTAR_JOBS" || {
        echo "⚠️  No se pudo descargar el cache, se compilará localmente"
    }
    
    echo "========================================="
    echo "Inicialización completa"
    echo "========================================="
else
    echo "✓ Mathlib ya inicializado"
    
    # Verificar si necesita actualización (no bloqueante)
    if [ -n "$LEAN_AUTO_UPDATE" ]; then
        echo "→ Verificando actualizaciones..."
        run_nice lake update --jobs "$LAKE_JOBS" &
    fi
fi

# Iniciar el servidor
exec "$@"
