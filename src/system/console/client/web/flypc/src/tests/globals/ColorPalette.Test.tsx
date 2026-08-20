import { ColorPalette } from '../../globals/ColorPalette'

describe('ColorPalette', () => {
  beforeEach(() => {
    ColorPalette.configure('Geekblue')
  })

  it('initializes with Geekblue as the default theme', () => {
    expect(ColorPalette.primary).toBe('#597ef7')
    expect(ColorPalette.secondary).toBe('#85a5ff')
  })

  it('configures the White palette', () => {
    ColorPalette.configure('White')

    expect(ColorPalette.primary).toBe('#efefef')
    expect(ColorPalette.secondary).toBe('#ffffff')
  })

  it('configures white + colored palettes', () => {
    ColorPalette.configure('White • Moss')

    expect(ColorPalette.primary).toBe('#efefef')
    expect(ColorPalette.secondary).toBe('#879f77')
  })

  it('detects light primary themes for on-primary text color', () => {
    expect(ColorPalette.isLightPrimaryTheme('White')).toBe(true)
    expect(ColorPalette.isLightPrimaryTheme('White • Blush')).toBe(true)
    expect(ColorPalette.isLightPrimaryTheme('Moss • Mist')).toBe(false)
    expect(ColorPalette.onPrimaryTextColor('White • Sage')).toBe('#000000')
    expect(ColorPalette.onPrimaryTextColor('Geekblue')).toBe('#ffffff')
  })

  it('falls back to Geekblue when configured with an invalid theme', () => {
    ColorPalette.configure('InvalidTheme' as unknown as keyof typeof ColorPalette.options)

    expect(ColorPalette.primary).toBe('#597ef7')
    expect(ColorPalette.secondary).toBe('#85a5ff')
  })

  it('keeps valid hex values when setting primary directly', () => {
    ColorPalette.primary = '#123456'
    expect(ColorPalette.primary).toBe('#123456')
  })

  it('falls back to Geekblue primary when setting an invalid primary value', () => {
    ColorPalette.primary = 'not-a-color'
    expect(ColorPalette.primary).toBe('#597ef7')
  })

  it('keeps valid hex values when setting secondary directly', () => {
    ColorPalette.secondary = '#abcdef'
    expect(ColorPalette.secondary).toBe('#abcdef')
  })

  it('falls back to Geekblue secondary when setting an invalid secondary value', () => {
    ColorPalette.secondary = 'invalid-color'
    expect(ColorPalette.secondary).toBe('#85a5ff')
  })
})
