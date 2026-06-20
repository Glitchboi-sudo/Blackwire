#!/usr/bin/env python3
"""
GitManager: versionado de proyectos mediante git.

Cada proyecto es una carpeta; este manager inicializa el repo, commitea cambios
y consulta el historial. Autocontenido salvo por `get_project_path` (config).
"""

import asyncio
import logging
import os
from typing import Optional, List

from config import get_project_path

logger = logging.getLogger('blackwire')


class GitManager:
    def __init__(self, name: str):
        self.repo_path = get_project_path(name)

    async def _ensure_identity(self) -> bool:
        async def _get_config(key: str) -> Optional[str]:
            proc = await asyncio.create_subprocess_exec(
                "git", "config", "--get", key,
                cwd=str(self.repo_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            value = stdout.decode().strip()
            return value or None

        name = await _get_config("user.name")
        email = await _get_config("user.email")
        if name and email:
            return True

        default_name = os.getenv("BLACKWIRE_GIT_NAME", "Blackwire")
        default_email = os.getenv("BLACKWIRE_GIT_EMAIL", "blackwire@local")
        proc = await asyncio.create_subprocess_exec(
            "git", "config", "user.name", default_name,
            cwd=str(self.repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        proc = await asyncio.create_subprocess_exec(
            "git", "config", "user.email", default_email,
            cwd=str(self.repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        return True

    async def init_repo(self):
        if not (self.repo_path / ".git").exists():
            proc = await asyncio.create_subprocess_exec("git", "init", cwd=str(self.repo_path),
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await proc.communicate()
            (self.repo_path / ".gitignore").write_text("*.pyc\n__pycache__/\n")
            await self._ensure_identity()
            await self.commit("Initial commit")

    async def commit(self, message: str) -> Optional[str]:
        await self._ensure_identity()
        proc = await asyncio.create_subprocess_exec(
            "git", "add", "-A", cwd=str(self.repo_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        proc = await asyncio.create_subprocess_exec(
            "git", "commit", "-m", message, cwd=str(self.repo_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            proc = await asyncio.create_subprocess_exec("git", "rev-parse", "HEAD", cwd=str(self.repo_path),
                stdout=asyncio.subprocess.PIPE)
            stdout, _ = await proc.communicate()
            return stdout.decode().strip()[:8]
        if stderr:
            logger.warning("Git commit failed: %s", stderr.decode().strip())
        return None

    async def get_history(self, limit: int = 50) -> List[dict]:
        proc = await asyncio.create_subprocess_exec("git", "log", f"-{limit}", "--pretty=format:%H|%s|%ai",
            cwd=str(self.repo_path), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await proc.communicate()
        commits = []
        for line in stdout.decode().strip().split("\n"):
            if line and "|" in line:
                parts = line.split("|")
                commits.append({"hash": parts[0][:8], "message": parts[1], "date": parts[2] if len(parts) > 2 else ""})
        return commits
