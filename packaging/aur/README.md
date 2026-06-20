# Paquetes AUR de Blackwire

Empaquetado de Blackwire para el **AUR** (Arch User Repository), de modo que se
instale con `yay -S blackwire` (o `paru -S blackwire`), resolviendo las
dependencias desde los repos oficiales.

Se empaqueta la **app web (fuente)**: corre el servidor local (FastAPI + React),
sin Docker. No es la versión de escritorio Tauri (esa vive en la release de GitHub).

| Carpeta | Paquete | Qué hace |
|---|---|---|
| `blackwire/` | `blackwire` | Versión estable, desde el tarball del release. |
| `blackwire-git/` | `blackwire-git` | Compila desde el último commit de `main` (VCS). `provides/conflicts blackwire`. |

Tras instalar, se ejecuta con el comando **`blackwire`** (o desde el menú de
aplicaciones). El estado de runtime (proyectos, certificados, config) se guarda en
`~/.local/share/blackwire/` — el `/usr/share/blackwire` queda de solo lectura.

## Probar el build en local (Arch)

```bash
cd packaging/aur/blackwire     # o blackwire-git
updpkgsums                     # calcula el sha256 del tarball (solo para 'blackwire')
makepkg -si                    # construye e instala
```

## Publicar por primera vez (manual)

Requiere una **cuenta en el AUR** con tu **clave SSH pública** registrada
(https://aur.archlinux.org → My Account → SSH Public Key).

```bash
# 1. Clona el repo (vacío) del paquete en el AUR
git clone ssh://aur@aur.archlinux.org/blackwire.git aur-blackwire
cd aur-blackwire

# 2. Copia el PKGBUILD y fija el checksum
cp /ruta/a/Blackwire/packaging/aur/blackwire/PKGBUILD .
updpkgsums                                   # reemplaza el sha256 'SKIP'
makepkg --printsrcinfo > .SRCINFO            # OBLIGATORIO en el AUR

# 3. Publica
git add PKGBUILD .SRCINFO
git commit -m "Initial release: blackwire 1.0.0"
git push
```

Repite para `blackwire-git` (clona `ssh://aur@aur.archlinux.org/blackwire-git.git`;
no necesita `updpkgsums` porque usa `git+`).

> **Regenera siempre `.SRCINFO`** (`makepkg --printsrcinfo > .SRCINFO`) tras cualquier
> cambio del PKGBUILD; el AUR lo exige y debe coincidir.

## Actualización automática (CI)

El workflow [`.github/workflows/aur.yml`](../../.github/workflows/aur.yml) actualiza
el paquete `blackwire` del AUR cuando publicas un **release estable** (o a mano con
*workflow_dispatch*).

Configúralo una vez:
1. Genera una clave SSH dedicada para el deploy y registra la **pública** en tu cuenta del AUR.
2. En el repo de GitHub: *Settings → Secrets and variables → Actions* → nuevo secret
   **`AUR_SSH_PRIVATE_KEY`** con la clave **privada**.

Mientras el secret no exista, el job se omite sin fallar. El paquete `blackwire-git`
no se actualiza por CI (rastrea git; republícalo a mano si cambias su PKGBUILD).

## Notas

- **Dependencias**: todas en los repos oficiales (`python-fastapi`, `python-uvicorn`,
  `mitmproxy`, `nodejs`, …), así que `yay` las resuelve solas.
- **Node** se usa en runtime para transpilar los componentes `.jsx` al vuelo (sucrase
  va vendorizado en el paquete); `App.jsx` se precompila durante el `build()`.
- **`git`** es opcional (solo para la integración de versiones por proyecto).
