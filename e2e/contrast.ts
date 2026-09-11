import type { Page } from '@playwright/test'

export interface ContrastFinding {
  selector: string
  ratio: number
  required: number
  text: string
}

export async function auditTextContrast(page: Page): Promise<ContrastFinding[]> {
  return page.evaluate(() => {
    type RGBA = [number, number, number, number]
    const parse = (color: string): RGBA => {
      const channels = color.match(/[\d.]+/g)?.map(Number) ?? []
      return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0, channels[3] ?? 1]
    }
    const composite = (front: RGBA, back: RGBA): RGBA => {
      const alpha = front[3] + back[3] * (1 - front[3])
      if (alpha === 0) return [0, 0, 0, 0]
      return [
        (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
        (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
        (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
        alpha,
      ]
    }
    const background = (element: Element): RGBA => {
      const layers: RGBA[] = []
      let current: Element | null = element
      while (current) {
        layers.push(parse(getComputedStyle(current).backgroundColor))
        current = current.parentElement
      }
      return layers.reverse().reduce((back, front) => composite(front, back), [0, 0, 0, 1] as RGBA)
    }
    const luminance = (color: RGBA): number => {
      const channels = color.slice(0, 3).map((channel) => {
        const normalized = channel / 255
        return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4
      })
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
    }
    const ratio = (left: RGBA, right: RGBA): number => {
      const [bright, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a)
      return (bright + .05) / (dark + .05)
    }
    const selector = (element: Element): string => {
      if (element.id) return `#${element.id}`
      const classes = [...element.classList].slice(0, 2).join('.')
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`
    }

    const findings: ContrastFinding[] = []
    for (const element of document.querySelectorAll('body *')) {
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
      const directText = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .join(' ')
        .trim()
      if (!directText) continue
      const fontSize = Number.parseFloat(style.fontSize)
      const weight = Number.parseInt(style.fontWeight, 10) || 400
      const required = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700) ? 3 : 4.5
      const measured = ratio(parse(style.color), background(element))
      if (measured + .01 < required) findings.push({ selector: selector(element), ratio: measured, required, text: directText.slice(0, 80) })
    }
    return findings
  })
}