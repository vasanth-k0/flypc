export class ColorPalette {
  static options = {
    White:
        ['#efefef', '#ffffff'],
    'White • Blush':
        ['#efefef', '#f4e9e7'],
    'White • Moss':
        ['#efefef', '#879f77'],
    'White • Sage':
        ['#efefef', '#b7bc96'],
    Geekblue: 
        ['#597ef7', '#85a5ff'],
    Indigo:
        ['#4f46e5', '#818cf8'],
    Slate:
        ['#475569', '#94a3b8'],
    Cyan:
        ['#0891b2', '#22d3ee'],
    Emerald:
        ['#059669', '#34d399'],
    Orange: 
        ['#efa04b', '#f7a854'],
    Amber:
        ['#d97706', '#fbbf24'],
    Green: 
        ['#2f9400', '#3daf08'],
    Red: 
        ['#cf1322', '#f5222d'],
    Rose:
        ['#e11d48', '#fb7185'],
    Purple: 
        ['#9254de', '#b37feb'],
    Violet:
        ['#7c3aed', '#a78bfa'],
    Teal: 
        ['#008894', '#07a0ae'],
    Brown: 
        ['#9c6603', '#c98404'],
    Gray: 
        ['#666B6A', '#8c8c8c'],
    Black: 
        ['#30353b', '#575f69'],
    Midnight:
        ['#1e293b', '#64748b'],
    'Grey • Green': 
        ['#666B6A', '#6fb374'],
    'Grey • Blue': 
        ['#666B6A', '#6c89d9'],
    'Grey • Teal': 
        ['#666B6A', '#1B9AAA'],
    'Grey • Brown': 
        ['#666B6A', '#c98404'],
    'Charcoal • Mint':
        ['#374151', '#2dd4bf'],
    'Navy • Sky':
        ['#1e3a5f', '#38bdf8'],
    'Black • Red': 
        ['#3f3e3e', '#b30303'],
    'Grey • Blush':
        ['#c4c3c5', '#f4e9e7'],
    'Moss • Mist':
        ['#879f77', '#e7e7e7'],
    'Sage • Rose':
        ['#b7bc96', '#b99b91'],
  } as const

  static _primary = ''
  static _secondary = ''
  static defaultTheme = 'Geekblue' as const

  /** Light primary palettes use dark text/icons on primary-colored surfaces. */
  static isLightPrimaryTheme(theme: string): boolean {
    return theme === 'White' || theme.startsWith('White • ')
  }

  static onPrimaryTextColor(theme: string): string {
    return ColorPalette.isLightPrimaryTheme(theme) ? '#000000' : '#ffffff'
  }

  static get primary() {
    return this._primary || this.options[this.defaultTheme][0]
  }

  static set primary(value: string) {
    this._primary = value.startsWith('#') ? value : this.options[this.defaultTheme][0]
  }

  static get secondary() {
    return this._secondary || this.options[this.defaultTheme][1]
  }

  static set secondary(value: string) {
    this._secondary = value.startsWith('#') ? value : this.options[this.defaultTheme][1]
  }

  static configure(colorTheme?: keyof typeof ColorPalette.options) {
    const theme = colorTheme && this.options[colorTheme] ? colorTheme : this.defaultTheme
    const colors = this.options[theme]
    this.primary = colors[0]
    this.secondary = colors[1]
  }

  static {
    this.configure(this.defaultTheme)
  }
}
