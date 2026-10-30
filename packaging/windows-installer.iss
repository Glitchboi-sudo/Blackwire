; Inno Setup script — instalador .exe de la app de escritorio Blackwire (Windows).
; Empaqueta la salida onedir de PyInstaller (dist\blackwire-desktop\) en un
; instalador por-usuario. El build de CI (.github/workflows/desktop.yml) ya ha
; colocado docker-compose.yml + blackwire-image.tar.gz junto al ejecutable.
;
; Compilar:  iscc /DBuildDir=dist\blackwire-desktop packaging\windows-installer.iss
; Salida:    packaging\Output\Blackwire-Setup-2.0.0-x64.exe

#define MyAppName "Blackwire"
#define MyAppVersion "2.0.0"
#define MyAppExeName "blackwire-desktop.exe"

[Setup]
AppId={{B1AC4717-0000-4000-A000-626C61636B77}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Blackwire
DefaultDirName={localappdata}\Programs\Blackwire
DefaultGroupName=Blackwire
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
OutputDir=Output
OutputBaseFilename=Blackwire-Setup-{#MyAppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
; La raíz del build se pasa por línea de comandos: iscc /DBuildDir=...\dist\blackwire-desktop
Source: "{#BuildDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\Blackwire"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Blackwire"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar Blackwire"; Flags: nowait postinstall skipifsilent
