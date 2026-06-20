#!/usr/bin/env python3
"""
Router de Chepy: catálogo de operaciones y ejecución de recetas.

No usa base de datos. La ejecución valida cada operación contra el allowlist
CHEPY_OPERATIONS antes de ejecutarla (seguridad).
"""

from fastapi import APIRouter

from schemas import ChepyRecipe, CHEPY_OPERATIONS

router = APIRouter()


@router.get("/api/chepy/operations")
async def get_chepy_operations():
    return {"operations": CHEPY_OPERATIONS}


@router.post("/api/chepy/bake")
async def bake_chepy(recipe: ChepyRecipe):
    from chepy_compat import run_operation
    try:
        value = recipe.input
        for op in recipe.operations:
            if op.name.startswith("_"):
                return {"error": f"Unknown operation: {op.name}"}
            allowed = any(
                o["name"] == op.name
                for cat_ops in CHEPY_OPERATIONS.values()
                for o in cat_ops
            )
            if not allowed:
                return {"error": f"Operation not allowed: {op.name}"}
            args = {k: v for k, v in op.args.items() if v != ""}
            value = run_operation(op.name, value, args)
        return {"output": value}
    except Exception as e:
        return {"error": str(e)}
