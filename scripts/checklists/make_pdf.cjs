// Rebuilds site/downloads/non-medical-prescriber-checklist.pdf from non-medical-prescriber.html. Run: node scripts/checklists/make_pdf.cjs
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + require('path').join(__dirname, 'non-medical-prescriber.html'));
await p.pdf({ path: '' + require('path').join(__dirname, '../../site/downloads/') + 'non-medical-prescriber-checklist.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });
await b.close(); })();
