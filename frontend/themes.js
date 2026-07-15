// Blackwire — catálogo de temas.
// Cada tema define exactamente las mismas 16 CSS custom properties. Se aplican
// como estilo inline sobre el div raíz `.app` (ver App.jsx). Las paletas son
// recreaciones de temas reconocidos por la comunidad, más el tema OLED propio
// "Kervoid". Se expone como global window.BW_THEMES al final del archivo.

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = '"Inter", system-ui, sans-serif';

const THEMES = {
  githubdark: {
    label: 'GitHub Dark',
    vars: {
      '--bg': '#0d1117',
      '--bg2': '#010409',
      '--bg3': '#161b22',
      '--bgh': '#21262d',
      '--brd': '#30363d',
      '--txt': '#e6edf3',
      '--txt2': '#c9d1d9',
      '--txt3': '#8b949e',
      '--blue': '#58a6ff',
      '--green': '#3fb950',
      '--red': '#f85149',
      '--orange': '#d29922',
      '--purple': '#bc8cff',
      '--cyan': '#56d4dd',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  dracula: {
    label: 'Dracula',
    vars: {
      '--bg': '#282a36',
      '--bg2': '#21222c',
      '--bg3': '#343746',
      '--bgh': '#44475a',
      '--brd': '#44475a',
      '--txt': '#f8f8f2',
      '--txt2': '#c0c3cf',
      '--txt3': '#6272a4',
      '--blue': '#bd93f9',
      '--green': '#50fa7b',
      '--red': '#ff5555',
      '--orange': '#ffb86c',
      '--purple': '#ff79c6',
      '--cyan': '#8be9fd',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  nord: {
    label: 'Nord',
    vars: {
      '--bg': '#2e3440',
      '--bg2': '#272c36',
      '--bg3': '#3b4252',
      '--bgh': '#434c5e',
      '--brd': '#4c566a',
      '--txt': '#eceff4',
      '--txt2': '#d8dee9',
      '--txt3': '#7b8494',
      '--blue': '#88c0d0',
      '--green': '#a3be8c',
      '--red': '#bf616a',
      '--orange': '#d08770',
      '--purple': '#b48ead',
      '--cyan': '#8fbcbb',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  tokyonight: {
    label: 'Tokyo Night',
    vars: {
      '--bg': '#1a1b26',
      '--bg2': '#16161e',
      '--bg3': '#24283b',
      '--bgh': '#2f334d',
      '--brd': '#3b4261',
      '--txt': '#c0caf5',
      '--txt2': '#a9b1d6',
      '--txt3': '#565f89',
      '--blue': '#7aa2f7',
      '--green': '#9ece6a',
      '--red': '#f7768e',
      '--orange': '#ff9e64',
      '--purple': '#bb9af7',
      '--cyan': '#7dcfff',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  catppuccin: {
    label: 'Catppuccin Mocha',
    vars: {
      '--bg': '#1e1e2e',
      '--bg2': '#181825',
      '--bg3': '#313244',
      '--bgh': '#45475a',
      '--brd': '#45475a',
      '--txt': '#cdd6f4',
      '--txt2': '#bac2de',
      '--txt3': '#7f849c',
      '--blue': '#89b4fa',
      '--green': '#a6e3a1',
      '--red': '#f38ba8',
      '--orange': '#fab387',
      '--purple': '#cba6f7',
      '--cyan': '#94e2d5',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  onedark: {
    label: 'One Dark',
    vars: {
      '--bg': '#282c34',
      '--bg2': '#21252b',
      '--bg3': '#2c313a',
      '--bgh': '#3b4048',
      '--brd': '#3e4451',
      '--txt': '#c8ccd4',
      '--txt2': '#abb2bf',
      '--txt3': '#5c6370',
      '--blue': '#61afef',
      '--green': '#98c379',
      '--red': '#e06c75',
      '--orange': '#d19a66',
      '--purple': '#c678dd',
      '--cyan': '#56b6c2',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  monokai: {
    label: 'Monokai',
    vars: {
      '--bg': '#272822',
      '--bg2': '#1f201b',
      '--bg3': '#32332c',
      '--bgh': '#3e3d32',
      '--brd': '#49483e',
      '--txt': '#f8f8f2',
      '--txt2': '#cfcfc2',
      '--txt3': '#75715e',
      '--blue': '#66d9ef',
      '--green': '#a6e22e',
      '--red': '#f92672',
      '--orange': '#fd971f',
      '--purple': '#ae81ff',
      '--cyan': '#66d9ef',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  gruvbox: {
    label: 'Gruvbox Dark',
    vars: {
      '--bg': '#282828',
      '--bg2': '#1d2021',
      '--bg3': '#3c3836',
      '--bgh': '#504945',
      '--brd': '#504945',
      '--txt': '#ebdbb2',
      '--txt2': '#d5c4a1',
      '--txt3': '#928374',
      '--blue': '#83a598',
      '--green': '#b8bb26',
      '--red': '#fb4934',
      '--orange': '#fe8019',
      '--purple': '#d3869b',
      '--cyan': '#8ec07c',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  solarizeddark: {
    label: 'Solarized Dark',
    vars: {
      '--bg': '#002b36',
      '--bg2': '#01242e',
      '--bg3': '#073642',
      '--bgh': '#0a4451',
      '--brd': '#0a4451',
      '--txt': '#93a1a1',
      '--txt2': '#839496',
      '--txt3': '#586e75',
      '--blue': '#268bd2',
      '--green': '#859900',
      '--red': '#dc322f',
      '--orange': '#cb4b16',
      '--purple': '#6c71c4',
      '--cyan': '#2aa198',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  rosepine: {
    label: 'Rosé Pine',
    vars: {
      '--bg': '#191724',
      '--bg2': '#1f1d2e',
      '--bg3': '#26233a',
      '--bgh': '#2a273f',
      '--brd': '#403d52',
      '--txt': '#e0def4',
      '--txt2': '#c8c5dd',
      '--txt3': '#6e6a86',
      '--blue': '#3e8fb0',
      '--green': '#5faaa0',
      '--red': '#eb6f92',
      '--orange': '#f6c177',
      '--purple': '#c4a7e7',
      '--cyan': '#9ccfd8',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  everforest: {
    label: 'Everforest',
    vars: {
      '--bg': '#2d353b',
      '--bg2': '#272e33',
      '--bg3': '#343f44',
      '--bgh': '#3d484d',
      '--brd': '#475258',
      '--txt': '#d3c6aa',
      '--txt2': '#beb499',
      '--txt3': '#859289',
      '--blue': '#7fbbb3',
      '--green': '#a7c080',
      '--red': '#e67e80',
      '--orange': '#e69875',
      '--purple': '#d699b6',
      '--cyan': '#83c092',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  nightowl: {
    label: 'Night Owl',
    vars: {
      '--bg': '#011627',
      '--bg2': '#010e1a',
      '--bg3': '#0b2942',
      '--bgh': '#1d3b53',
      '--brd': '#1d3b53',
      '--txt': '#d6deeb',
      '--txt2': '#a5b3c9',
      '--txt3': '#637777',
      '--blue': '#82aaff',
      '--green': '#addb67',
      '--red': '#ef5350',
      '--orange': '#f78c6c',
      '--purple': '#c792ea',
      '--cyan': '#7fdbca',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  ayu: {
    label: 'Ayu Dark',
    vars: {
      '--bg': '#0d1017',
      '--bg2': '#0b0e14',
      '--bg3': '#131721',
      '--bgh': '#1b1f2b',
      '--brd': '#1f2430',
      '--txt': '#bfbdb6',
      '--txt2': '#9a9791',
      '--txt3': '#565b66',
      '--blue': '#59c2ff',
      '--green': '#aad94c',
      '--red': '#f26d78',
      '--orange': '#ffb454',
      '--purple': '#d2a6ff',
      '--cyan': '#95e6cb',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  cobalt: {
    label: 'Cobalt2',
    vars: {
      '--bg': '#193549',
      '--bg2': '#122738',
      '--bg3': '#1e415e',
      '--bgh': '#234e6d',
      '--brd': '#0d3a58',
      '--txt': '#ffffff',
      '--txt2': '#aabfd0',
      '--txt3': '#627e97',
      '--blue': '#3b8eea',
      '--green': '#3ad900',
      '--red': '#ff628c',
      '--orange': '#ffc600',
      '--purple': '#fb94ff',
      '--cyan': '#80fcff',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  githublight: {
    label: 'GitHub Light',
    vars: {
      '--bg': '#ffffff',
      '--bg2': '#f6f8fa',
      '--bg3': '#eaeef2',
      '--bgh': '#eef1f4',
      '--brd': '#d0d7de',
      '--txt': '#1f2328',
      '--txt2': '#57606a',
      '--txt3': '#8c959f',
      '--blue': '#0969da',
      '--green': '#1a7f37',
      '--red': '#cf222e',
      '--orange': '#bc4c00',
      '--purple': '#8250df',
      '--cyan': '#1b7c83',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  solarizedlight: {
    label: 'Solarized Light',
    vars: {
      '--bg': '#fdf6e3',
      '--bg2': '#eee8d5',
      '--bg3': '#e7e0cc',
      '--bgh': '#dcd5c0',
      '--brd': '#d8d0bb',
      '--txt': '#586e75',
      '--txt2': '#657b83',
      '--txt3': '#93a1a1',
      '--blue': '#268bd2',
      '--green': '#859900',
      '--red': '#dc322f',
      '--orange': '#cb4b16',
      '--purple': '#6c71c4',
      '--cyan': '#2aa198',
      '--font-main': SANS,
      '--font-mono': MONO
    }
  },
  kervoid: {
    label: 'Kervoid',
    vars: {
      '--bg': '#000000',
      '--bg2': '#050505',
      '--bg3': '#0d0d0d',
      '--bgh': '#161616',
      '--brd': '#262626',
      '--txt': '#ffffff',
      '--txt2': '#b0b0b0',
      '--txt3': '#6e6e6e',
      '--blue': '#ff1744',
      '--green': '#00e676',
      '--red': '#ff1744',
      '--orange': '#ffab00',
      '--purple': '#ff4081',
      '--cyan': '#ff5c77',
      '--font-main': '"Space Grotesk", "Inter", system-ui, sans-serif',
      '--font-mono': MONO
    }
  }
};

window.BW_THEMES = THEMES;
