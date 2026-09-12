// One-off helper: generates a small sample multi-page PDF for local testing.
const fs = require('fs');
const path = require('path');

const pages = [
  { title: 'The Little Brave Bird', sub: 'A story about courage and never giving up' },
  { title: 'Once upon a time...', sub: 'there lived a little bird in a green forest' },
  { title: '"A small bird can also', sub: 'have a big dream!"' },
  { title: 'The End', sub: 'Dream Big, Fly High!' },
];

function esc(s) { return s.replace(/([()\\])/g, '\\$1'); }

const objects = [];
objects.push('<< /Type /Catalog /Pages 2 0 R >>');
const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // obj 3 = font

pages.forEach((p, i) => {
  const pageObjNum = 4 + i * 2;
  const contentObjNum = pageObjNum + 1;
  objects[pageObjNum - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjNum} 0 R >>`;
  const stream = `BT /F1 28 Tf 60 500 Td (${esc(p.title)}) Tj ET\nBT /F1 16 Tf 60 460 Td (${esc(p.sub)}) Tj ET\nBT /F1 12 Tf 60 60 Td (Page ${i + 1} of ${pages.length}) Tj ET`;
  objects[contentObjNum - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
});

let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((obj, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
});
const xrefStart = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i <= objects.length; i++) {
  pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

fs.writeFileSync(path.join(__dirname, '..', 'story.pdf'), pdf, 'binary');
console.log('story.pdf written,', pages.length, 'pages');
