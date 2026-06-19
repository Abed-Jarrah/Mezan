const { test, expect } = require('playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('browser unit suite passes', async ({ page }) => {
  await page.goto('/tests.html');
  const summary = await page.evaluate(() => ({
    pass: document.querySelectorAll('.pass').length,
    fail: document.querySelectorAll('.fail').length
  }));
  expect(summary.fail).toBe(0);
  expect(summary.pass).toBeGreaterThanOrEqual(35);
});

test('wizard creates a valid plan using keyboard navigation', async ({ page }) => {
  await expect(page.getByText('كيف نناديك؟')).toBeVisible();
  await page.locator('#displayName').fill('أحمد');
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.locator('#salary').fill('8000');
  await page.locator('#salary').press('Enter');
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.locator('#saveTarget').fill('1000');
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('button', { name: 'اعتماد الخطة' }).click();
  await expect(page.getByRole('heading', { name: 'لوحة دورتك المالية' })).toBeVisible();
  await expect(page.getByText('أهلاً أحمد')).toBeVisible();
  await expect(page.getByText('ملخص اليوم')).toBeVisible();
  await expect(page.locator('.balance-orb-card')).toBeVisible();
});

test('expense flow updates the interactive balance circle', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('mezan_plan_v5', JSON.stringify({
      schemaVersion: 5,
      settings: { lang: 'ar', currency: 'QAR', lastBackupAt: '' },
      profile: {
        salary: 8000, salaryDate: new Date().toISOString().slice(0, 10), extraIncome: 0,
        rentPaid: 'no', rent: 0, internet: 0, electricity: 0, phone: 0,
        fuel: 0, fixed: 0, loans: 0, saveTarget: 1000, goalType: 'general',
        goalName: '', goalAmount: 0, goalMonths: 0
      },
      expenses: [], categoryBudgets: {}, recurringPayments: [], salaryReceipts: [],
      cycleReports: [], merchantCategories: {}, budgetAlerts: {}
    }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'أضف مصروف' }).click();
  await page.locator('#exAmount').fill('500');
  await page.locator('#exMerchant').fill('مطعم');
  await page.getByRole('button', { name: 'حفظ المصروف' }).click();
  await expect(page.locator('.balance-orb-card')).toContainText('6,500');
  await expect(page.getByText('صرفت اليوم')).toBeVisible();
  await expect(page.getByText('إنشاء نسخة الآن')).toHaveCount(0);
  await expect(page.getByText('مصروفات الدورة')).toBeVisible();
  await expect(page.locator('.category-donut')).toBeVisible();
  await expect(page.locator('.goal-ring')).toContainText('%');
});

test('language switches the interface and currency symbol', async ({ page }) => {
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByText('What should we call you?')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#wizardCurrency')).toContainText('QAR');
});

test('assistant tab sends questions when worker is configured', async ({ page }) => {
  await page.route('https://mezan-chat.mezan-finance.workers.dev/chat', async route => {
    const request = route.request();
    const payload = request.postDataJSON();
    expect(request.headers().authorization).toBe('Bearer test-id-token');
    expect(payload.question).toBe('كم باقي من راتبي؟');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ answer: 'باقي مبلغ جيد من الراتب.' })
    });
  });
  await page.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('mezan_plan_v5', JSON.stringify({
      schemaVersion: 5,
      settings: { lang: 'ar', currency: 'QAR', lastBackupAt: '', chatUserId: 'mzn-e2e' },
      profile: { salary: 8000, salaryDate: today, extraIncome: 0, rentPaid: 'no', rent: 0, internet: 0, electricity: 0, phone: 0, fuel: 0, fixed: 0, loans: 0, saveTarget: 1000, goalType: 'general', goalName: '', goalAmount: 0, goalMonths: 0 },
      expenses: [], categoryBudgets: {}, recurringPayments: [], salaryReceipts: [{ id: 1, date: today, amount: 8000 }],
      cycleReports: [], merchantCategories: {}, budgetAlerts: {}
    }));
  });
  await page.reload();
  await page.evaluate(() => MezanAuth.__setTestToken('test-id-token', { name: 'Tester', email: 't@example.com' }));
  await page.getByRole('button', { name: 'مساعد' }).click();
  await expect(page.getByRole('heading', { name: 'مساعد ميزان' })).toBeVisible();
  await expect(page.locator('#chatQuestion')).toBeEnabled();
  await page.locator('#chatQuestion').fill('كم باقي من راتبي؟');
  await page.getByRole('button', { name: 'إرسال' }).click();
  await expect(page.getByText('باقي مبلغ جيد من الراتب.')).toBeVisible();
});

test('reset dialog requires the confirmation word', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('mezan_plan_v5', JSON.stringify({
      schemaVersion: 5, settings: { lang: 'ar', currency: 'QAR' },
      profile: { salary: 8000, salaryDate: new Date().toISOString().slice(0, 10) }
    }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'إعدادات' }).click();
  await page.getByRole('button', { name: 'مسح كل البيانات' }).click();
  const confirm = page.getByRole('button', { name: 'مسح نهائي' });
  await expect(confirm).toBeDisabled();
  await page.locator('#resetConfirmInput').fill('مسح');
  await expect(confirm).toBeEnabled();
});
