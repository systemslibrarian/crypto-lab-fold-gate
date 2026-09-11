import { expect, test } from '@playwright/test'
import { auditTextContrast } from './contrast'
import { axeFindings, openLab } from './gate'
import { NON_TEXT_BASELINE } from './nontext-baseline'
import { auditNonTextContrast } from './nontext'

test.beforeEach(async ({ page }) => openLab(page))

test('has no WCAG A/AA or landmark findings in shipped states', async ({ page }) => {
  expect(await axeFindings(page)).toEqual([])
  await page.getByRole('button', { name: 'Show plain fold' }).click()
  await page.getByRole('button', { name: 'Compute cross term T' }).click()
  await page.getByRole('button', { name: 'Derive r and relax' }).click()
  await page.getByRole('button', { name: 'Fold 8 steps' }).click()
  await expect(page.getByText('FOLDED 8 → 1, VALID')).toBeVisible()
  await page.getByRole('button', { name: 'Open final W′ and E′' }).click()
  expect(await axeFindings(page)).toEqual([])
})

test('passes arithmetic text and non-text contrast audits', async ({ page }) => {
  const textFindings = await auditTextContrast(page)
  expect(textFindings, JSON.stringify(textFindings, null, 2)).toEqual([])
  const nonTextFindings = await auditNonTextContrast(page)
  const unbaselined = nonTextFindings.filter((finding) => !NON_TEXT_BASELINE.includes(finding.selector))
  expect(unbaselined, JSON.stringify(unbaselined, null, 2)).toEqual([])
})

test('supports keyboard focus and a narrow viewport without overflow', async ({ page }) => {
  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
})