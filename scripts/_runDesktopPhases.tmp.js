async function runDesktopPhases() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    report.consoleMessages.push({ type: msg.type(), text });
    if (msg.type() === 'warning') report.consoleWarnings.push(text);
    if (msg.type() === 'error') report.consoleErrors.push(text);
  });
  page.on('pageerror', (err) => {
    report.consoleErrors.push(err.message);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });

  const flags = { s0: false, s1: false, s3: false, s4: false, s5: false };
  let final = null;
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const m = await page.evaluate(shadowQuery);

    if (!flags.s0 && m.hasTldrawCanvas && m.h1.includes('Meridian Labs')) {
      await capture(page, 'cursor-browser-01-initial-load-desktop.png', 'S0-US1');
      report.steps.push({ step: 'S0-initial', metrics: m });
      flags.s0 = true;
    }

    if (!flags.s1 && m.funnelLabelsFound.length >= 4 && m.stencilLabelsFound.length >= 4) {
      await captureWhiteboard(page, 'cursor-browser-02-whiteboard-wireframe.png', 'S1-US2');
      report.steps.push({ step: 'S1-wireframe', metrics: m });
      flags.s1 = true;
    }

    if (
      !flags.s3 &&
      m.documentPanelVisible &&
      m.documentTitleVisible &&
      (m.meridianDocumentResult?.ok === true || m.blockTypesFound.length >= 3)
    ) {
      await capture(page, 'cursor-browser-04-document-panel.png', 'S3-US3');
      report.steps.push({ step: 'S3-document', metrics: m });
      flags.s3 = true;
    }

    if (!flags.s4 && (m.exportMessageVisible || m.meridianExportResult?.ok === true)) {
      await capture(page, 'cursor-browser-05-export-confirmation.png', 'S4-US4');
      report.steps.push({ step: 'S4-export', metrics: m });
      flags.s4 = true;
    }

    if (!flags.s5 && m.approvalLayerVisible && m.approvalBadgeVisible) {
      await capture(page, 'cursor-browser-06-hitl-approval-card.png', 'S5-US5');
      report.steps.push({ step: 'S5-hitl', metrics: m });
      flags.s5 = true;
    }

    if (
      m.galleryReady?.example === '12-open-agent-canvas' &&
      typeof m.galleryReady?.ok === 'boolean'
    ) {
      final = m;
      if (flags.s0 && flags.s1 && flags.s3 && flags.s4 && flags.s5) break;
    }

    await page.waitForTimeout(25);
  }

  if (final) {
    report.steps.push({ step: 'final-settle', metrics: final });
  }

  await context.close();
  return final;
}
