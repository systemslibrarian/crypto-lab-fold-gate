import type { Page } from '@playwright/test'

export interface NonTextFinding {
  selector: string
  reason: string
}

export async function auditNonTextContrast(page: Page): Promise<NonTextFinding[]> {
  return page.evaluate(() => {
    type RGB = [number, number, number]
    const parse = (color: string): RGB => {
      const values = color.match(/[\d.]+/g)?.map(Number) ?? []
      return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0]
    }
    const luminance = (color: RGB): number => {
      const [red, green, blue] = color.map((channel) => {
        const normalized = channel / 255
        return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4
      })
      return .2126 * red + .7152 * green + .0722 * blue
    }
    const contrast = (left: RGB, right: RGB): number => {
      const [bright, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a)
      return (bright + .05) / (dark + .05)
    }
    const effectiveBackground = (element: Element): string => {
      let current: Element | null = element
      while (current) {
        const color = getComputedStyle(current).backgroundColor
        if (!color.endsWith(', 0)') && color !== 'transparent') return color
        current = current.parentElement
      }
      return 'rgb(9, 12, 17)'
    }
    const identify = (element: Element): string => element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`
    const findings: NonTextFinding[] = []

    for (const element of document.querySelectorAll('button, select, summary, input, [role="button"]')) {
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || element.matches(':disabled')) continue
      const widths = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
      const styles = [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle]
      const paintedSides = widths.map((width, index) => Number.parseFloat(width) > 0 && styles[index] !== 'none')
      if (!paintedSides.some(Boolean)) continue
      const borderColors = [style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor]
      const background = parse(effectiveBackground(element.parentElement ?? element))
      const bestRatio = Math.max(...borderColors.filter((_, index) => paintedSides[index]).map((color) => contrast(parse(color), background)))
      if (bestRatio < 3) findings.push({ selector: identify(element), reason: `boundary contrast ${bestRatio.toFixed(2)}:1` })
    }
    return findings
  })
}