export class ColorPalette {
  static options = {
    Geekblue: 
        ['#597ef7', '#85a5ff'],
    Lime: 
        ['#37d637', '#3ae43a'],
    Orange: 
        ['#efa04b', '#f7a854'],
    Green: 
        ['#2f9400', '#3daf08'],
    Red: 
        ['#cf1322', '#f5222d'],
    Purple: 
        ['#9254de', '#b37feb'],
    Teal: 
        ['#008894', '#07a0ae'],
    Brown: 
        ['#9c6603', '#c98404'],
    Gray: 
        ['#666B6A', '#8c8c8c'],
    Black: 
        ['#30353b', '#575f69'],
    'Grey • Green': 
        ['#666B6A', '#6fb374'],
    'Grey • Blue': 
        ['#666B6A', '#6c89d9'],
    'Grey • Teal': 
        ['#666B6A', '#1B9AAA'],
    'Grey • Brown': 
        ['#666B6A', '#c98404'],
    'Black • Red': 
        ['#3f3e3e', '#b30303'],
  } as const

  static _primary = ''
  static _secondary = ''
  static defaultTheme = 'Geekblue' as const

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

