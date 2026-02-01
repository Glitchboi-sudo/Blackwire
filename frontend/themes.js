const THEMES = {
  midnight: {
    label: 'Midnight',
    vars: {
      '--bg': '#0a0e14',
      '--bg2': '#0d1117',
      '--bg3': '#161b22',
      '--bgh': '#1f262d',
      '--brd': '#30363d',
      '--txt': '#e6edf3',
      '--txt2': '#8b949e',
      '--txt3': '#6e7681',
      '--blue': '#58a6ff',
      '--green': '#3fb950',
      '--red': '#f85149',
      '--orange': '#d29922',
      '--purple': '#a371f7',
      '--cyan': '#39c5cf',
      '--font-main': '"Inter", system-ui, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace'
    }
  },
  dusk: {
    label: 'Dusk',
    vars: {
      '--bg': '#11101a',
      '--bg2': '#161525',
      '--bg3': '#1d1c2e',
      '--bgh': '#25233a',
      '--brd': '#34324a',
      '--txt': '#f0e9ff',
      '--txt2': '#b9b2d6',
      '--txt3': '#8a83a8',
      '--blue': '#7aa2ff',
      '--green': '#8bd49c',
      '--red': '#ff7a7a',
      '--orange': '#ffb86c',
      '--purple': '#c792ff',
      '--cyan': '#7fe7ff',
      '--font-main': '"Space Grotesk", "Inter", system-ui, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace'
    }
  },
  paper: {
    label: 'Paper',
    vars: {
      '--bg': '#f5f4f0',
      '--bg2': '#ffffff',
      '--bg3': '#f0eee9',
      '--bgh': '#e7e4dd',
      '--brd': '#d7d3c9',
      '--txt': '#1f2328',
      '--txt2': '#5b636e',
      '--txt3': '#7a828c',
      '--blue': '#255cbb',
      '--green': '#1a7f37',
      '--red': '#c43c3c',
      '--orange': '#b96b00',
      '--purple': '#6b4bb6',
      '--cyan': '#0f7f7a',
      '--font-main': '"IBM Plex Sans", "Inter", system-ui, sans-serif',
      '--font-mono': '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace'
    }
  },
  gruvbox: {
    label: 'Gruvbox',
    vars: {
      '--bg': '#282828',
      '--bg2': '#32302f',
      '--bg3': '#3c3836',
      '--bgh': '#45403d',
      '--brd': '#504945',
      '--txt': '#ebdbb2',
      '--txt2': '#d5c4a1',
      '--txt3': '#a89984',
      '--blue': '#83a598',
      '--green': '#b8bb26',
      '--red': '#fb4934',
      '--orange': '#fe8019',
      '--purple': '#d3869b',
      '--cyan': '#8ec07c',
      '--font-main': '"IBM Plex Sans", "Inter", system-ui, sans-serif',
      '--font-mono': '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace'
    }
  },
  solarized: {
    label: 'Solarized',
    vars: {
      '--bg': '#fdf6e3',
      '--bg2': '#f5efdc',
      '--bg3': '#eee8d5',
      '--bgh': '#e6dfc8',
      '--brd': '#d5cbb3',
      '--txt': '#073642',
      '--txt2': '#586e75',
      '--txt3': '#657b83',
      '--blue': '#268bd2',
      '--green': '#859900',
      '--red': '#dc322f',
      '--orange': '#b58900',
      '--purple': '#6c71c4',
      '--cyan': '#2aa198',
      '--font-main': '"IBM Plex Sans", "Inter", system-ui, sans-serif',
      '--font-mono': '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace'
    }
  },
  aurora: {
    label: 'Aurora',
    vars: {
      '--bg': '#0b0f14',
      '--bg2': '#111822',
      '--bg3': '#192330',
      '--bgh': '#223042',
      '--brd': '#2e3d53',
      '--txt': '#e4f0ff',
      '--txt2': '#a9bfd8',
      '--txt3': '#7b93b0',
      '--blue': '#4aa8ff',
      '--green': '#42d392',
      '--red': '#ff6b7d',
      '--orange': '#ffb86b',
      '--purple': '#b48cff',
      '--cyan': '#4bd2e6',
      '--font-main': '"Space Grotesk", "Inter", system-ui, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace'
    }
  },
  noir: {
    label: 'Noir',
    vars: {
      '--bg': '#0b0b0c',
      '--bg2': '#121214',
      '--bg3': '#1a1a1f',
      '--bgh': '#23232a',
      '--brd': '#2b2b35',
      '--txt': '#f1f1f4',
      '--txt2': '#c3c3ca',
      '--txt3': '#8f8f9b',
      '--blue': '#7aa2ff',
      '--green': '#7ed491',
      '--red': '#ff6f7d',
      '--orange': '#f6b66a',
      '--purple': '#c49bff',
      '--cyan': '#6bd6ff',
      '--font-main': '"Inter", system-ui, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace'
    }
  },
  glacier: {
    label: 'Glacier',
    vars: {
      '--bg': '#0e141b',
      '--bg2': '#141c24',
      '--bg3': '#1b2530',
      '--bgh': '#243140',
      '--brd': '#2f3f52',
      '--txt': '#e6f2f8',
      '--txt2': '#b9d0dd',
      '--txt3': '#8aa6b8',
      '--blue': '#63b3ff',
      '--green': '#5bd6b4',
      '--red': '#ff7c8b',
      '--orange': '#ffb36b',
      '--purple': '#9aa8ff',
      '--cyan': '#6ee7ff',
      '--font-main': '"IBM Plex Sans", "Inter", system-ui, sans-serif',
      '--font-mono': '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace'
    }
  },
  ember: {
    label: 'Ember',
    vars: {
      '--bg': '#140b0b',
      '--bg2': '#1b1111',
      '--bg3': '#241818',
      '--bgh': '#2e2020',
      '--brd': '#3a2828',
      '--txt': '#ffe9e4',
      '--txt2': '#f0bdb3',
      '--txt3': '#c48f84',
      '--blue': '#6aa7ff',
      '--green': '#a6e06b',
      '--red': '#ff6b6b',
      '--orange': '#ff9f5a',
      '--purple': '#d39bff',
      '--cyan': '#6ee7d8',
      '--font-main': '"Space Grotesk", "Inter", system-ui, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace'
    }
  },
  forest: {
    label: 'Forest',
    vars: {
      '--bg': '#0e1410',
      '--bg2': '#141c16',
      '--bg3': '#1b261f',
      '--bgh': '#243226',
      '--brd': '#2f3f33',
      '--txt': '#e6f3e7',
      '--txt2': '#b9d1be',
      '--txt3': '#8aa493',
      '--blue': '#6ba7ff',
      '--green': '#6ad98f',
      '--red': '#ff7676',
      '--orange': '#ffb86b',
      '--purple': '#b28cff',
      '--cyan': '#5fd8c2',
      '--font-main': '"IBM Plex Sans", "Inter", system-ui, sans-serif',
      '--font-mono': '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace'
    }
  },
  oceanic: {
    label: 'Oceanic',
    vars: {
      '--bg': '#07141a',
      '--bg2': '#0c1b23',
      '--bg3': '#122630',
      '--bgh': '#193241',
      '--brd': '#234356',
      '--txt': '#e3f6ff',
      '--txt2': '#acd3e3',
      '--txt3': '#7aa6ba',
      '--blue': '#3ea8ff',
      '--green': '#4dd6b8',
      '--red': '#ff6f80',
      '--orange': '#ffb36a',
      '--purple': '#9c8cff',
      '--cyan': '#3ed6ff',
      '--font-main': '"Inter", system-ui, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace'
    }
  },
  rose: {
    label: 'Rose',
    vars: {
      '--bg': '#1a0f14',
      '--bg2': '#22141b',
      '--bg3': '#2c1b25',
      '--bgh': '#372230',
      '--brd': '#452a3b',
      '--txt': '#ffe7f0',
      '--txt2': '#f2bcd0',
      '--txt3': '#c78fa8',
      '--blue': '#7aa2ff',
      '--green': '#7ed4a6',
      '--red': '#ff6f8d',
      '--orange': '#ffb36a',
      '--purple': '#c08cff',
      '--cyan': '#6fd6e8',
      '--font-main': '"Space Grotesk", "Inter", system-ui, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace'
    }
  },
  mono: {
    label: 'Mono',
    vars: {
      '--bg': '#0f1115',
      '--bg2': '#151821',
      '--bg3': '#1d2230',
      '--bgh': '#262d3d',
      '--brd': '#313a4e',
      '--txt': '#f2f5f9',
      '--txt2': '#c6ccd7',
      '--txt3': '#8c95a6',
      '--blue': '#9bb3ff',
      '--green': '#9bd6b4',
      '--red': '#ff8f9c',
      '--orange': '#ffc38a',
      '--purple': '#c2b0ff',
      '--cyan': '#8fdfff',
      '--font-main': '"IBM Plex Sans", "Inter", system-ui, sans-serif',
      '--font-mono': '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace'
    }
  },
  desert: {
    label: 'Desert',
    vars: {
      '--bg': '#1a140d',
      '--bg2': '#221a12',
      '--bg3': '#2c2318',
      '--bgh': '#372c1f',
      '--brd': '#453625',
      '--txt': '#f8efe6',
      '--txt2': '#e0c6ac',
      '--txt3': '#b2957a',
      '--blue': '#7aa2ff',
      '--green': '#9ed38a',
      '--red': '#ff7a6b',
      '--orange': '#ffb05a',
      '--purple': '#b58cff',
      '--cyan': '#6fd6c7',
      '--font-main': '"IBM Plex Sans", "Inter", system-ui, sans-serif',
      '--font-mono': '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace'
    }
  },
  synth: {
    label: 'Synth',
    vars: {
      '--bg': '#0b0714',
      '--bg2': '#120b1e',
      '--bg3': '#1b1030',
      '--bgh': '#24163f',
      '--brd': '#2f1d54',
      '--txt': '#f6e8ff',
      '--txt2': '#cdb2e0',
      '--txt3': '#9a7bb5',
      '--blue': '#6aa7ff',
      '--green': '#4dd6b8',
      '--red': '#ff5fa2',
      '--orange': '#ffb86b',
      '--purple': '#b57bff',
      '--cyan': '#55d6ff',
      '--font-main': '"Space Grotesk", "Inter", system-ui, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace'
    }
  }
};

window.BW_THEMES = THEMES;
