import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
export const BEST_PRACTICE_RULES = ['landmark-one-main', 'page-has-heading-one', 'region', 'skip-link', 'landmark-unique', 'heading-order']

export async function openLab(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'Fold Gate' })).toBeVisible()
  await expect(page.locator('#app')).toContainText('One constraint system')
  expect((await page.locator('#app').innerText()).length).toBeGreaterThan(1_000)
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)

  const paintedHidden = await page.locator('[hidden]').evaluateAll((elements) => elements
    .filter((element) => getComputedStyle(element).display !== 'none')
    .map((element) => element.outerHTML.slice(0, 120)))
  expect(paintedHidden, `hidden elements painted: ${paintedHidden.join('\n')}`).toEqual([])
}

export async function axeFindings(page: Page): Promise<string[]> {
  const wcag = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const bestPractice = await new AxeBuilder({ page }).withRules(BEST_PRACTICE_RULES).analyze()
  return [...wcag.violations, ...wcag.incomplete, ...bestPractice.violations, ...bestPractice.incomplete]
    .map((finding) => `${finding.id}: ${finding.help} (${finding.nodes.map((node) => node.target.join(' ')).join(', ')})`)
}